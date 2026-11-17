import { bootApp, type TestApp } from './helpers/app.js';
import { createCompany, createWorker } from './helpers/fixtures.js';

type Worker = Awaited<ReturnType<typeof createWorker>>;

let t: TestApp;

beforeAll(async () => {
  t = await bootApp();
});
afterAll(() => t.app.close());

// A company whose workers each got `amounts[i]` disbursed through the real flow, with the period closed.
async function closedPeriod(amounts: number[]) {
  const fx = await createCompany(t.prisma);
  const adminToken = t.tokenFor(fx.admin);
  const workers: Worker[] = [];
  for (const amount of amounts) {
    const w = await createWorker(t.prisma, fx.company.id);
    const res = await t.post('/worker/advances', t.tokenFor(w.user!, w.worker.id)).send({ amount, acknowledgeWarnings: true });
    expect(res.body.status).toBe('DISBURSED');
    workers.push(w);
  }
  const closed = await t.post(`/compensation/periods/${fx.period.id}/close`, adminToken);
  expect(closed.status).toBe(201);
  expect(closed.body.lines).toHaveLength(amounts.length);
  const lineOf = (i: number) => t.prisma.compensationLine.findUniqueOrThrow({ where: { periodId_workerId: { periodId: fx.period.id, workerId: workers[i].worker.id } } });
  const applied = (items: object) => t.post(`/compensation/periods/${fx.period.id}/applied`, adminToken).send(items);
  return { fx, adminToken, workers, lineOf, applied };
}

describe('reconciliation with opposite differences', () => {
  it('does not net them to zero: reports the absolute difference and blocks the close without force', async () => {
    const { fx, adminToken, workers, applied } = await closedPeriod([100_000, 100_000]);

    const res = await applied({
      items: [
        { docNumber: workers[0].worker.docNumber, amount: 150_000 },
        { docNumber: workers[1].worker.docNumber, amount: 50_000 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.reconciliation).toMatchObject({ differenceTotal: 0, absoluteDifference: 100_000, status: 'WITH_DIFFERENCES' });
    expect(await t.prisma.incident.count({ where: { companyId: fx.company.id, category: 'RECONCILIATION' } })).toBe(1);

    const blocked = await t.post(`/compensation/periods/${fx.period.id}/reconcile`, adminToken).send({});
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/Quedan diferencias por \$100\.000/);
    const noNote = await t.post(`/compensation/periods/${fx.period.id}/reconcile`, adminToken).send({ force: true });
    expect(noNote.status).toBe(400);

    const forced = await t.post(`/compensation/periods/${fx.period.id}/reconcile`, adminToken).send({ force: true, note: 'Diferencias aceptadas por nómina' });
    expect(forced.status).toBe(201);
    expect(forced.body.reconciliation.status).toBe('RECONCILED');
    expect((await t.prisma.payrollPeriod.findUniqueOrThrow({ where: { id: fx.period.id } })).status).toBe('RECONCILED');
    expect(await t.prisma.incident.count({ where: { companyId: fx.company.id, category: 'RECONCILIATION', status: { not: 'RESOLVED' } } })).toBe(0);
  });

  it('closes without force when everything matches', async () => {
    const { fx, adminToken, workers, applied } = await closedPeriod([100_000]);
    const res = await applied({ items: [{ docNumber: workers[0].worker.docNumber, amount: 100_000 }] });
    expect(res.body.reconciliation).toMatchObject({ differenceTotal: 0, absoluteDifference: 0 });
    const closed = await t.post(`/compensation/periods/${fx.period.id}/reconcile`, adminToken).send({});
    expect(closed.status).toBe(201);
    expect(closed.body.reconciliation.status).toBe('RECONCILED');
  });
});

describe('reported amounts', () => {
  it('parses text amounts into pesos, rejects garbage without touching the lines, and keeps the sign', async () => {
    const { workers, lineOf, applied } = await closedPeriod([103_000]);
    const doc = workers[0].worker.docNumber;

    for (const amount of ['103000.00', '$ 103.000', '103,000']) {
      const ok = await applied({ items: [{ docNumber: doc, amount }] });
      expect(ok.status, amount).toBe(201);
      expect(await lineOf(0), amount).toMatchObject({ compensatedAmount: 103_000, difference: 0, status: 'APPLIED' });
    }

    const bad = await applied({ items: [{ docNumber: doc, amount: 'mucho' }] });
    expect(bad.status).toBe(400);
    expect(await lineOf(0)).toMatchObject({ compensatedAmount: 103_000, status: 'APPLIED' });

    const negative = await applied({ items: [{ docNumber: doc, amount: '-5000' }] });
    expect(negative.status).toBe(201);
    expect(await lineOf(0)).toMatchObject({ compensatedAmount: -5000, difference: 108_000 });
  });

  it('accepts the CSV the company exports from its payroll system', async () => {
    const { fx, adminToken, workers, lineOf } = await closedPeriod([103_000]);
    const file = Buffer.from(`documento,valor_descontado\n${workers[0].worker.docNumber},"103.000"`);
    const res = await t.post(`/compensation/periods/${fx.period.id}/applied`, adminToken).attach('file', file, { filename: 'descontado.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(await lineOf(0)).toMatchObject({ compensatedAmount: 103_000, status: 'APPLIED' });
  });

  it('needs the period closed first', async () => {
    const fx = await createCompany(t.prisma);
    const res = await t.post(`/compensation/periods/${fx.period.id}/applied`, t.tokenFor(fx.admin)).send({ items: [{ docNumber: '1', amount: 1 }] });
    expect(res.status).toBe(400);
  });
});
