import { bootApp, type TestApp } from './helpers/app.js';
import { createCompany, createFlexaAdmin, createWorker } from './helpers/fixtures.js';

let t: TestApp;
let flexa: string;

beforeAll(async () => {
  t = await bootApp();
  flexa = t.tokenFor(await createFlexaAdmin(t.prisma));
});
afterAll(() => t.app.close());

describe('PATCH /admin/companies/:id/settings', () => {
  it('validates ranges, types and cross-field rules', async () => {
    const fx = await createCompany(t.prisma);
    const patch = (body: object, token = flexa, id = fx.company.id) => t.patch(`/admin/companies/${id}/settings`, token).send(body);

    expect((await patch({ maxAdvancePct: 500 })).status).toBe(400);
    expect((await patch({ feePerRequest: 'abc' })).status).toBe(400);
    // Lowering the cap under the stored recommended (25) is rejected against the stored values.
    expect((await patch({ maxAdvancePct: 10 })).status).toBe(400);
    expect((await patch({ minAmount: 5_000_000 })).status).toBe(400);
    for (const body of [{}, { notASetting: 1 }]) {
      const res = await patch(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.message).toBe('Sin parámetros válidos');
    }
    expect((await patch({ maxAdvancePct: 60 }, flexa, 'no-such-company')).status).toBe(404);
    expect((await patch({ maxAdvancePct: 60 }, t.tokenFor(fx.admin))).status).toBe(403);
    expect((await t.prisma.companySettings.findUniqueOrThrow({ where: { companyId: fx.company.id } })).maxAdvancePct).toBe(50);

    const ok = await patch({ maxAdvancePct: 60, recommendedPct: 30 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ maxAdvancePct: 60, recommendedPct: 30, minAmount: 20_000 });
    const audit = await t.prisma.auditLog.findFirst({ where: { companyId: fx.company.id, action: 'UPDATED_BY_FLEXA' } });
    expect(audit).not.toBeNull();
  });
});

describe('admin routes are FLEXA only', () => {
  it('company and worker users get 403', async () => {
    const fx = await createCompany(t.prisma);
    const w = await createWorker(t.prisma, fx.company.id);
    for (const token of [t.tokenFor(fx.admin), t.tokenFor(fx.finance), t.tokenFor(w.user!, w.worker.id)]) {
      expect((await t.get('/admin/overview', token)).status).toBe(403);
      expect((await t.get('/admin/kyc', token)).status).toBe(403);
    }
    expect((await t.get('/admin/overview', flexa)).status).toBe(200);
  });
});

describe('POST /admin/kyc/:workerId', () => {
  const manualReview = async () => {
    const fx = await createCompany(t.prisma);
    return createWorker(t.prisma, fx.company.id, { onboarded: false, kycStatus: 'MANUAL_REVIEW' });
  };

  it('approves: worker status, a KycCheck row and the audit record appear together; a second decision is refused', async () => {
    const { worker } = await manualReview();
    const queue = await t.get('/admin/kyc', flexa);
    expect(queue.body.some((w: { id: string }) => w.id === worker.id)).toBe(true);

    const res = await t.post(`/admin/kyc/${worker.id}`, flexa).send({ status: 'APPROVED', note: 'Documento verificado' });
    expect(res.status).toBe(201);
    expect(res.body.kycStatus).toBe('APPROVED');
    expect((await t.prisma.worker.findUniqueOrThrow({ where: { id: worker.id } })).kycStatus).toBe('APPROVED');
    const checks = await t.prisma.kycCheck.findMany({ where: { workerId: worker.id, type: 'MANUAL_REVIEW' } });
    expect(checks).toEqual([expect.objectContaining({ status: 'APPROVED', provider: 'FLEXA', detail: 'Documento verificado' })]);
    expect(await t.prisma.auditLog.count({ where: { entity: 'Worker', entityId: worker.id, action: 'KYC_APPROVED' } })).toBe(1);

    const again = await t.post(`/admin/kyc/${worker.id}`, flexa).send({ status: 'REJECTED', note: 'Cambio de opinión' });
    expect(again.status).toBe(400);
    expect((await t.prisma.worker.findUniqueOrThrow({ where: { id: worker.id } })).kycStatus).toBe('APPROVED');
    expect(await t.prisma.kycCheck.count({ where: { workerId: worker.id, type: 'MANUAL_REVIEW' } })).toBe(1);
  });

  it('rejects: the audit record says KYC_REJECTED', async () => {
    const { worker } = await manualReview();
    const res = await t.post(`/admin/kyc/${worker.id}`, flexa).send({ status: 'REJECTED', note: 'Documento ilegible' });
    expect(res.status).toBe(201);
    expect((await t.prisma.worker.findUniqueOrThrow({ where: { id: worker.id } })).kycStatus).toBe('REJECTED');
    expect(await t.prisma.auditLog.count({ where: { entityId: worker.id, action: 'KYC_REJECTED' } })).toBe(1);
  });

  it('two parallel decisions: one wins, the other is a 400, one check is stored', async () => {
    const { worker } = await manualReview();
    const results = await Promise.all([
      t.post(`/admin/kyc/${worker.id}`, flexa).send({ status: 'APPROVED', note: 'uno' }),
      t.post(`/admin/kyc/${worker.id}`, flexa).send({ status: 'REJECTED', note: 'dos' }),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 400]);
    expect(await t.prisma.kycCheck.count({ where: { workerId: worker.id, type: 'MANUAL_REVIEW' } })).toBe(1);
  });

  it('refuses workers that are not in manual review and unknown workers', async () => {
    const fx = await createCompany(t.prisma);
    const approved = await createWorker(t.prisma, fx.company.id);
    expect((await t.post(`/admin/kyc/${approved.worker.id}`, flexa).send({ status: 'REJECTED', note: 'x' })).status).toBe(400);
    expect((await t.post('/admin/kyc/no-such-worker', flexa).send({ status: 'APPROVED', note: 'x' })).status).toBe(404);
    expect((await t.post(`/admin/kyc/${approved.worker.id}`, flexa).send({ status: 'MAYBE', note: 'x' })).status).toBe(400);
  });
});
