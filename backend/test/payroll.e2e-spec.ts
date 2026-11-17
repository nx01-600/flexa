import { bootApp, type TestApp } from './helpers/app.js';
import { createCompany, createWorker, type CompanyFx } from './helpers/fixtures.js';

let t: TestApp;
let fx: CompanyFx;
let adminToken: string;
let financeToken: string;

beforeAll(async () => {
  t = await bootApp();
  fx = await createCompany(t.prisma);
  adminToken = t.tokenFor(fx.admin);
  financeToken = t.tokenFor(fx.finance);
});
afterAll(() => t.app.close());

const REGISTERED = 1_500_000;
// Loaded by the company but not registered: payroll only needs the Worker row.
const newWorker = (salary = REGISTERED) => createWorker(t.prisma, fx.company.id, { registered: false, salary });
type W = Awaited<ReturnType<typeof newWorker>>;

const upload = (file: Buffer, filename = 'nomina.csv', contentType = 'text/csv') =>
  t.post(`/payroll/periods/${fx.period.id}/upload`, adminToken).attach('file', file, { filename, contentType });
const csv = (...lines: string[]) => Buffer.from(lines.join('\n'));
const entryOf = (w: W) => t.prisma.payrollEntry.findUnique({ where: { periodId_workerId: { periodId: fx.period.id, workerId: w.worker.id } } });
const salaryOf = async (w: W) => (await t.prisma.worker.findUniqueOrThrow({ where: { id: w.worker.id } })).baseSalary;
const issuesOf = (body: { issues: { docNumber?: string; field: string; severity: string; message: string }[] }, w: W) =>
  body.issues.filter((i) => i.docNumber === w.worker.docNumber);

describe('payroll CSV upload', () => {
  it('stores pesos correctly for 1500000.50, 1.500.000 and "1500000,50"', async () => {
    const [a, b, c] = [await newWorker(), await newWorker(), await newWorker()];
    const res = await upload(
      csv('documento,salario,dias_trabajados', `${a.worker.docNumber},1500000.50,10`, `${b.worker.docNumber},1.500.000,10`, `${c.worker.docNumber},"1500000,50",10`),
    );
    expect(res.status).toBe(201);
    expect(res.body.okRows).toBe(3);
    expect(res.body.status).not.toBe('PROCESSING');
    expect((await entryOf(a))!.baseSalary).toBe(1_500_001);
    expect((await entryOf(b))!.baseSalary).toBe(1_500_000);
    expect((await entryOf(c))!.baseSalary).toBe(1_500_001);
    expect(await salaryOf(a)).toBe(1_500_001);
    expect(await salaryOf(b)).toBe(1_500_000);
    expect(await salaryOf(c)).toBe(1_500_001);
  });

  it('reads a semicolon file with a decimal comma', async () => {
    const d = await newWorker();
    const res = await upload(csv('documento;salario;dias_trabajados', `${d.worker.docNumber};1500000,50;12`));
    expect(res.status).toBe(201);
    expect(res.body.okRows).toBe(1);
    expect(await entryOf(d)).toMatchObject({ baseSalary: 1_500_001, workedDays: 12 });
  });

  it('turns bad rows into issues, applies the good row and always ends in a final status', async () => {
    const [x10, zero, tooManyDays, fractionalDays, good] = [await newWorker(), await newWorker(), await newWorker(), await newWorker(), await newWorker()];
    const res = await upload(
      csv(
        'documento,salario,dias_trabajados',
        `${x10.worker.docNumber},15000000,10`,
        `${zero.worker.docNumber},0,10`,
        `${tooManyDays.worker.docNumber},1500000,45`,
        `${fractionalDays.worker.docNumber},1500000,12.5`,
        `${good.worker.docNumber},1550000,10`,
      ),
    );
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WITH_ISSUES');
    expect(res.body.okRows).toBe(1);
    const stored = await t.prisma.payrollUpload.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.status).toBe('WITH_ISSUES');

    // Salary about x10: rejected, nothing applied, registered salary untouched.
    expect(issuesOf(res.body, x10)).toEqual([expect.objectContaining({ field: 'salario', severity: 'ERROR', message: expect.stringMatching(/30 %/) })]);
    expect(await entryOf(x10)).toBeNull();
    expect(await salaryOf(x10)).toBe(REGISTERED);

    expect(issuesOf(res.body, zero)).toEqual([expect.objectContaining({ field: 'salario', severity: 'ERROR', message: 'El salario debe ser mayor a 0' })]);
    expect(await entryOf(zero)).toBeNull();

    expect(issuesOf(res.body, tooManyDays)).toEqual([expect.objectContaining({ field: 'dias_trabajados', severity: 'ERROR', message: expect.stringMatching(/Supera los 30 días/) })]);
    expect(issuesOf(res.body, fractionalDays)).toEqual([expect.objectContaining({ field: 'dias_trabajados', severity: 'ERROR', message: expect.stringMatching(/entero/) })]);
    expect(await entryOf(tooManyDays)).toBeNull();
    expect(await entryOf(fractionalDays)).toBeNull();

    expect((await entryOf(good))!.baseSalary).toBe(1_550_000);
    expect(await t.prisma.incident.count({ where: { companyId: fx.company.id, category: 'PAYROLL_DATA' } })).toBeGreaterThan(0);
  });

  it('a file with only bad rows ends FAILED, not 500 and not PROCESSING', async () => {
    const bad = await newWorker();
    const res = await upload(csv('documento,salario', `${bad.worker.docNumber},abc`, `${bad.worker.docNumber},1500000`, ',1500000'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('FAILED');
    expect(res.body.issues.some((i: { message: string }) => i.message === 'Valor inválido')).toBe(true);
    expect(res.body.issues.some((i: { message: string }) => i.message === 'Documento faltante')).toBe(true);
  });

  it('rejects an .xlsx, a csv sent as image/png and a file over 5 MB', async () => {
    expect((await upload(csv('documento,salario'), 'nomina.xlsx')).status).toBe(400);
    expect((await upload(csv('documento,salario'), 'nomina.csv', 'image/png')).status).toBe(400);
    expect((await upload(Buffer.alloc(5 * 1024 * 1024 + 1024, 0x61), 'big.csv')).status).toBe(413);
    expect((await t.post(`/payroll/periods/${fx.period.id}/upload`, adminToken)).status).toBe(400);
  });

  it('is admin only and scoped to the own company', async () => {
    const res = await t.post(`/payroll/periods/${fx.period.id}/upload`, financeToken).attach('file', csv('documento,salario'), { filename: 'n.csv', contentType: 'text/csv' });
    expect(res.status).toBe(403);
    const other = await createCompany(t.prisma);
    const foreign = await t.post(`/payroll/periods/${fx.period.id}/upload`, t.tokenFor(other.admin)).attach('file', csv('documento,salario'), { filename: 'n.csv', contentType: 'text/csv' });
    expect(foreign.status).toBe(404);
  });
});

describe('ERP sync', () => {
  // key: the company key by default, or an explicit one (null = no header).
  const sync = (body: object, key: string | null = fx.company.apiKey) => {
    const req = t.post('/payroll/erp/sync');
    return (key ? req.set('x-api-key', key) : req).send(body);
  };

  it('needs a valid API key', async () => {
    expect((await sync({ entries: [] }, null)).status).toBe(401);
    expect((await sync({ entries: [] }, 'flx_nope')).status).toBe(401);
  });

  it('rejects entries that are not objects', async () => {
    expect((await sync({ entries: [null] })).status).toBe(400);
    expect((await sync({ entries: 'x' })).status).toBe(400);
    expect((await sync({})).status).toBe(400);
  });

  it('applies a numeric salary with decimals as whole pesos', async () => {
    const w = await newWorker();
    const res = await sync({ entries: [{ documento: Number(w.worker.docNumber), salario: 1500000.5 }] });
    expect(res.status).toBe(201);
    expect(res.body.okRows).toBe(1);
    expect((await entryOf(w))!.baseSalary).toBe(1_500_001);
    expect(await salaryOf(w)).toBe(1_500_001);
  });
});

describe('period budget', () => {
  const setBudget = (token: string, body: object) => t.patch(`/payroll/periods/${fx.period.id}/budget`, token).send(body);

  it('Finance cannot set it', async () => {
    expect((await setBudget(financeToken, { budget: 5_000_000 })).status).toBe(403);
  });

  it('the admin needs a valid non-negative integer', async () => {
    for (const body of [{ budget: -1 }, { budget: 1.5 }, {}, { budget: 'mucho' }]) expect((await setBudget(adminToken, body)).status, JSON.stringify(body)).toBe(400);
    const ok = await setBudget(adminToken, { budget: 5_000_000 });
    expect(ok.status).toBe(200);
    expect((await t.prisma.payrollPeriod.findUniqueOrThrow({ where: { id: fx.period.id } })).budget).toBe(5_000_000n);
    const read = await t.get(`/payroll/periods/${fx.period.id}`, financeToken);
    expect(read.status).toBe(200);
    expect(read.body.budget).toBe(5_000_000);
  });
});
