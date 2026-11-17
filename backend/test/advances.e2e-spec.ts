import { PaymentsProvider } from '../src/common/providers.js';
import { bootApp, type TestApp } from './helpers/app.js';
import {
  addAccount,
  badAccount,
  createCompany,
  createFlexaAdmin,
  createWorker,
  floorTo,
  okAccount,
  type DEFAULT_SETTINGS,
} from './helpers/fixtures.js';

let t: TestApp;
let transfer: ReturnType<typeof vi.spyOn>;
let flexaToken: string;

beforeAll(async () => {
  t = await bootApp();
  // Calls through to the sandbox: it only counts how many times money was "sent".
  transfer = vi.spyOn(t.app.get(PaymentsProvider), 'transfer');
  flexaToken = t.tokenFor(await createFlexaAdmin(t.prisma));
});
afterAll(() => t.app.close());
// Braces: a returned function would be run by vitest as the teardown.
beforeEach(() => {
  transfer.mockClear();
});

// One worker whose default account is bad (…0000) unless told otherwise.
async function setup(settings: Partial<typeof DEFAULT_SETTINGS> = {}, account = badAccount()) {
  const fx = await createCompany(t.prisma, { settings });
  const w = await createWorker(t.prisma, fx.company.id, { account });
  return { fx, w, adminToken: t.tokenFor(fx.admin), workerToken: t.tokenFor(w.user!, w.worker.id) };
}

const requestAdvance = (token: string, amount: number, bankAccountId?: string) =>
  t.post('/worker/advances', token).send({ amount, bankAccountId, acknowledgeWarnings: true });

const availableOf = async (token: string) => (await t.get('/worker/earnings', token)).body.available as number;

const eventsOf = (advanceId: string, status?: string) =>
  t.prisma.advanceEvent.findMany({ where: { advanceId, ...(status ? { status: status as never } : {}) } });

describe('failed disbursement', () => {
  it('a transfer rejected by the bank ends FAILED with an event and an incident, never stuck', async () => {
    const { workerToken, w } = await setup();
    const res = await requestAdvance(workerToken, 60_000);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('FAILED');
    const events = (await eventsOf(res.body.id)).map((e) => e.status);
    expect(events).toContain('FAILED');
    expect(events).not.toContain('DISBURSED');
    const incident = await t.prisma.incident.findFirst({ where: { advanceId: res.body.id, category: 'DISBURSEMENT_FAILED' } });
    expect(incident).not.toBeNull();
    expect(incident!.workerId).toBe(w.worker.id);
    // FAILED frees the amount again.
    expect(await availableOf(workerToken)).toBeGreaterThanOrEqual(60_000);
  });
});

describe('concurrent retry', () => {
  it('two parallel retries of one FAILED advance send money exactly once', async () => {
    const { w, workerToken, adminToken } = await setup();
    const failed = (await requestAdvance(workerToken, 60_000)).body;
    expect(failed.status).toBe('FAILED');
    await t.prisma.bankAccount.update({ where: { id: w.account!.id }, data: { number: okAccount() } });
    transfer.mockClear();

    const [byCompany, byFlexa] = await Promise.all([
      t.post(`/company/advances/${failed.id}/retry`, adminToken),
      t.post(`/admin/advances/${failed.id}/retry`, flexaToken),
    ]);

    const wins = [byCompany, byFlexa].filter((r) => r.status >= 200 && r.status < 300);
    const losses = [byCompany, byFlexa].filter((r) => r.status >= 400 && r.status < 500);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect([400, 409]).toContain(losses[0].status);
    expect(transfer).toHaveBeenCalledTimes(1);

    const after = await t.prisma.advance.findUniqueOrThrow({ where: { id: failed.id } });
    expect(after.status).toBe('DISBURSED');
    expect(after.providerRef).toBeTruthy();
    expect(await eventsOf(failed.id, 'DISBURSED')).toHaveLength(1);
  });
});

describe('retry preconditions', () => {
  it('is rejected when the freed amount was spent again and no longer fits', async () => {
    const { w, workerToken, adminToken } = await setup();
    const available = await availableOf(workerToken);
    // 60 % each: one fits, but the second no longer fits once the first is out.
    const amount = floorTo(available * 0.6);
    const failed = (await requestAdvance(workerToken, amount)).body;
    expect(failed.status).toBe('FAILED');

    const good = await addAccount(t.prisma, w.worker.id, okAccount());
    const spent = await requestAdvance(workerToken, amount, good.id);
    expect(spent.status).toBe(201);
    expect(spent.body.status).toBe('DISBURSED');
    // The only reason left for the retry to fail is the availability.
    await t.prisma.bankAccount.update({ where: { id: w.account!.id }, data: { number: okAccount() } });
    transfer.mockClear();

    const res = await t.post(`/company/advances/${failed.id}/retry`, adminToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/supera el disponible/);
    expect(transfer).not.toHaveBeenCalled();
    expect((await t.prisma.advance.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe('FAILED');
  });

  it('is rejected when the payroll period is no longer OPEN', async () => {
    const { fx, w, workerToken, adminToken } = await setup();
    const failed = (await requestAdvance(workerToken, 60_000)).body;
    expect(failed.status).toBe('FAILED');
    await t.prisma.bankAccount.update({ where: { id: w.account!.id }, data: { number: okAccount() } });
    await t.prisma.payrollPeriod.update({ where: { id: fx.period.id }, data: { status: 'CLOSED' } });
    transfer.mockClear();

    const res = await t.post(`/company/advances/${failed.id}/retry`, adminToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El periodo de nómina de esta solicitud ya no está abierto');
    expect(transfer).not.toHaveBeenCalled();
    expect((await t.prisma.advance.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe('FAILED');
  });

  it('is rejected when the worker was disabled after the failure', async () => {
    const { w, workerToken, adminToken } = await setup();
    const failed = (await requestAdvance(workerToken, 60_000)).body;
    expect(failed.status).toBe('FAILED');
    await t.prisma.bankAccount.update({ where: { id: w.account!.id }, data: { number: okAccount() } });
    await t.prisma.worker.update({ where: { id: w.worker.id }, data: { enabled: false, status: 'RETIRED' } });
    transfer.mockClear();

    const res = await t.post(`/company/advances/${failed.id}/retry`, adminToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^No se puede reintentar/);
    expect(transfer).not.toHaveBeenCalled();
    expect((await t.prisma.advance.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe('FAILED');
  });

  it('a period with an in-flight advance cannot be closed, and a closed one cannot be closed again', async () => {
    const { fx, workerToken, adminToken } = await setup({ exceptionAmount: 100_000 }, okAccount());
    const pending = await requestAdvance(workerToken, 150_000);
    expect(pending.body.status).toBe('EXCEPTION');
    const blocked = await t.post(`/compensation/periods/${fx.period.id}/close`, adminToken);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/^Hay 1 solicitudes sin terminar/);

    expect((await t.post(`/worker/advances/${pending.body.id}/cancel`, workerToken)).status).toBe(201);
    expect((await t.post(`/compensation/periods/${fx.period.id}/close`, adminToken)).status).toBe(201);
    const again = await t.post(`/compensation/periods/${fx.period.id}/close`, adminToken);
    expect(again.status).toBe(400);
    expect(again.body.message).toBe('El periodo ya fue cerrado');
  });

  it('only retries FAILED advances', async () => {
    const { workerToken, adminToken } = await setup({}, okAccount());
    const ok = (await requestAdvance(workerToken, 60_000)).body;
    expect(ok.status).toBe('DISBURSED');
    const res = await t.post(`/company/advances/${ok.id}/retry`, adminToken);
    expect(res.status).toBe(400);
  });
});

describe('exception advances', () => {
  // exceptionAmount 100.000: a 150.000 request waits for the company.
  const exceptionSetup = async () => {
    const s = await setup({ exceptionAmount: 100_000 }, okAccount());
    const created = await requestAdvance(s.workerToken, 150_000);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('EXCEPTION');
    return { ...s, advanceId: created.body.id as string };
  };

  it('two parallel approvals pay once', async () => {
    const { advanceId, adminToken } = await exceptionSetup();
    transfer.mockClear();

    const results = await Promise.all([
      t.post(`/company/advances/${advanceId}/approve`, adminToken).send({ note: 'revisado uno' }),
      t.post(`/company/advances/${advanceId}/approve`, adminToken).send({ note: 'revisado dos' }),
    ]);

    expect(results.filter((r) => r.status >= 200 && r.status < 300)).toHaveLength(1);
    const loser = results.find((r) => r.status >= 400)!;
    expect([400, 409]).toContain(loser.status);
    expect(transfer).toHaveBeenCalledTimes(1);
    expect((await t.prisma.advance.findUniqueOrThrow({ where: { id: advanceId } })).status).toBe('DISBURSED');
    expect(await eventsOf(advanceId, 'DISBURSED')).toHaveLength(1);
    expect(await eventsOf(advanceId, 'APPROVED')).toHaveLength(1);
  });

  it('cancel and approve in parallel: exactly one wins and the loser changes nothing', async () => {
    const { advanceId, adminToken, workerToken } = await exceptionSetup();
    transfer.mockClear();

    const [cancel, approve] = await Promise.all([
      t.post(`/worker/advances/${advanceId}/cancel`, workerToken),
      t.post(`/company/advances/${advanceId}/approve`, adminToken).send({ note: 'revisado' }),
    ]);

    expect([cancel, approve].filter((r) => r.status >= 200 && r.status < 300)).toHaveLength(1);
    const loser = cancel.status >= 400 ? cancel : approve;
    expect([400, 409]).toContain(loser.status);
    const status = (await t.prisma.advance.findUniqueOrThrow({ where: { id: advanceId } })).status;
    if (cancel.status < 300) {
      expect(status).toBe('CANCELLED');
      expect(transfer).not.toHaveBeenCalled();
    } else {
      expect(status).toBe('DISBURSED');
      expect(transfer).toHaveBeenCalledTimes(1);
    }
  });
});

describe('fee', () => {
  it('amount + fee must fit in the available, in simulate and in the request', async () => {
    const { workerToken } = await setup({ feePerRequest: 1000 }, okAccount());
    const available = await availableOf(workerToken);
    expect(available).toBeGreaterThan(10_000);

    const tooMuch = await t.post('/worker/simulate', workerToken).send({ amount: available });
    expect(tooMuch.status).toBe(201);
    expect(tooMuch.body.valid).toBe(false);
    expect(tooMuch.body.errors).toContain('El monto más la comisión supera tu disponible');

    const fits = await t.post('/worker/simulate', workerToken).send({ amount: available - 1000 });
    expect(fits.body.valid).toBe(true);
    expect(fits.body.toDiscountFromPayroll).toBe(available);

    const rejected = await requestAdvance(workerToken, available);
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toBe('El monto más la comisión supera tu disponible');

    const accepted = await requestAdvance(workerToken, available - 1000);
    expect(accepted.status).toBe(201);
    expect(accepted.body.fee).toBe(1000);
    expect(await availableOf(workerToken)).toBe(0);
  });
});
