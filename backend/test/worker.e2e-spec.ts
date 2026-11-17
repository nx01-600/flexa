import { randomInt } from 'node:crypto';
import { bootApp, type TestApp } from './helpers/app.js';
import { BLACKOUT_PERIOD, createCompany, createWorker, okAccount } from './helpers/fixtures.js';

let t: TestApp;

beforeAll(async () => {
  t = await bootApp();
});
afterAll(() => t.app.close());

describe('POST /worker/kyc', () => {
  // The sandbox decides by cédula: …999 fails the selfie match, …000 goes to manual review, anything else passes.
  async function runKyc(docNumber: string, body: object = {}) {
    const fx = await createCompany(t.prisma);
    const w = await createWorker(t.prisma, fx.company.id, { docNumber, onboarded: false });
    const res = await t.post('/worker/kyc', t.tokenFor(w.user!, w.worker.id)).send(body);
    const stored = await t.prisma.worker.findUniqueOrThrow({ where: { id: w.worker.id } });
    const checks = await t.prisma.kycCheck.findMany({ where: { workerId: w.worker.id } });
    return { res, stored, checks };
  }
  const docEndingIn = (suffix: string) => `${randomInt(1_000_000, 9_999_999)}${suffix}`;

  it('ignores a selfieScore sent by the client', async () => {
    const { res, stored, checks } = await runKyc(docEndingIn('999'), { selfieScore: 1 });
    // Either stripped (201) or refused (400): never trusted.
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.status).toBe('REJECTED');
      expect(stored.kycStatus).toBe('REJECTED');
    }
    expect(checks.find((c) => c.type === 'SELFIE_BIOMETRIC' && c.score === 1)).toBeUndefined();
    if (res.status === 201) expect(checks.find((c) => c.type === 'SELFIE_BIOMETRIC')?.score).toBe(0.42);
  });

  it('approves a normal cédula and stores the provider score', async () => {
    const { res, stored, checks } = await runKyc(docEndingIn('123'), { selfieScore: 0 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('APPROVED');
    expect(stored.kycStatus).toBe('APPROVED');
    expect(checks.find((c) => c.type === 'SELFIE_BIOMETRIC')?.score).toBe(0.93);
  });

  it('sends a cédula ending in 000 to manual review', async () => {
    const { res, stored } = await runKyc(docEndingIn('000'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('MANUAL_REVIEW');
    expect(stored.kycStatus).toBe('MANUAL_REVIEW');
  });
});

describe('blackout window', () => {
  it('blocks service payments, simulations and requests the days before pay day', async () => {
    const fx = await createCompany(t.prisma, { period: BLACKOUT_PERIOD });
    const w = await createWorker(t.prisma, fx.company.id);
    const token = t.tokenFor(w.user!, w.worker.id);
    const message = 'No se reciben solicitudes 2 días antes del pago de nómina';

    const payment = await t.post('/worker/payments', token).send({ amount: 30_000, kind: 'PAGO', category: 'Servicios públicos', biller: 'EPM', reference: 'Ref 123' });
    expect(payment.status).toBe(400);
    expect(payment.body.message).toBe(message);
    expect(await t.prisma.servicePayment.count({ where: { workerId: w.worker.id } })).toBe(0);

    const simulated = await t.post('/worker/simulate', token).send({ amount: 30_000 });
    expect(simulated.body.valid).toBe(false);
    expect(simulated.body.errors).toContain(message);
    const advance = await t.post('/worker/advances', token).send({ amount: 30_000, acknowledgeWarnings: true });
    expect(advance.status).toBe(400);
    expect((await t.get('/worker/earnings', token)).body.canRequest).toBe(false);
  });
});

describe('request cap', () => {
  it('stops advances at the cap but still allows service payments outside the blackout', async () => {
    const fx = await createCompany(t.prisma, { settings: { maxRequestsPerPeriod: 1 } });
    const w = await createWorker(t.prisma, fx.company.id, { account: okAccount() });
    const token = t.tokenFor(w.user!, w.worker.id);

    const first = await t.post('/worker/advances', token).send({ amount: 50_000, acknowledgeWarnings: true });
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('DISBURSED');

    const second = await t.post('/worker/advances', token).send({ amount: 50_000, acknowledgeWarnings: true });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/Alcanzaste el máximo de 1 solicitudes/);

    const available = (await t.get('/worker/earnings', token)).body.available as number;
    const payment = await t.post('/worker/payments', token).send({ amount: 30_000, kind: 'RECARGA', category: 'Telefonía', biller: 'Claro', reference: '3001234567' });
    expect(payment.status).toBe(201);
    expect(payment.body.amount).toBe(30_000);
    const left = (await t.get('/worker/earnings', token)).body.available as number;
    expect(left).toBe(available - 30_000);

    const tooMuch = await t.post('/worker/payments', token).send({ amount: left + 1000, kind: 'PAGO', category: 'Internet', biller: 'Claro hogar', reference: '1' });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toBe('El monto supera tu disponible');
  });
});

describe('worker access control', () => {
  it('a worker cannot read another worker advance, and company staff cannot use worker routes', async () => {
    const fx = await createCompany(t.prisma);
    const [a, b] = [await createWorker(t.prisma, fx.company.id), await createWorker(t.prisma, fx.company.id)];
    const mine = await t.post('/worker/advances', t.tokenFor(a.user!, a.worker.id)).send({ amount: 50_000, acknowledgeWarnings: true });
    expect(mine.status).toBe(201);
    expect((await t.get(`/worker/advances/${mine.body.id}`, t.tokenFor(a.user!, a.worker.id))).status).toBe(200);
    expect((await t.get(`/worker/advances/${mine.body.id}`, t.tokenFor(b.user!, b.worker.id))).status).toBe(404);
    expect((await t.post(`/worker/advances/${mine.body.id}/cancel`, t.tokenFor(b.user!, b.worker.id))).status).toBe(404);
    expect((await t.get('/worker/earnings', t.tokenFor(fx.admin))).status).toBe(403);
  });
});
