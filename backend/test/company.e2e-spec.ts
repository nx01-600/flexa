import { bootApp, type TestApp } from './helpers/app.js';
import { badAccount, createCompany, createWorker, dotted, insertAdvance, PASSWORD, randomDoc, uid } from './helpers/fixtures.js';

let t: TestApp;

beforeAll(async () => {
  t = await bootApp();
});
afterAll(() => t.app.close());

describe('PATCH /company/settings', () => {
  it('checks the merged result against the stored values', async () => {
    const fx = await createCompany(t.prisma);
    const admin = t.tokenFor(fx.admin);
    const patch = (token: string, body: object) => t.patch('/company/settings', token).send(body);
    const before = (await t.get('/company/settings', admin)).body;
    expect(before.recommendedPct).toBe(25);

    const lowCap = await patch(admin, { maxAdvancePct: 10 });
    expect(lowCap.status).toBe(400);
    expect(lowCap.body.message).toBe('El recomendado no puede superar el tope');
    expect((await patch(admin, { minAmount: 5_000_000 })).status).toBe(400);
    expect((await patch(admin, { maxAdvancePct: 500 })).status).toBe(400);
    expect((await patch(admin, { feePerRequest: 'abc' })).status).toBe(400);
    expect((await t.get('/company/settings', admin)).body).toEqual(before);

    const fee = await patch(admin, { feePerRequest: 250 });
    expect(fee.status).toBe(200);
    expect(fee.body).toEqual({ ...before, feePerRequest: 250 });

    expect((await patch(t.tokenFor(fx.finance), { feePerRequest: 0 })).status).toBe(403);
    expect((await t.get('/company/settings', t.tokenFor(fx.finance))).status).toBe(200);
  });
});

describe('POST /company/incidents', () => {
  it('404s for a worker or advance of another company and creates nothing', async () => {
    const [mine, theirs] = [await createCompany(t.prisma), await createCompany(t.prisma)];
    const admin = t.tokenFor(mine.admin);
    const own = await createWorker(t.prisma, mine.company.id);
    const foreign = await createWorker(t.prisma, theirs.company.id);
    const ownAdvance = await insertAdvance(t.prisma, { workerId: own.worker.id, periodId: mine.period.id, bankAccountId: own.account!.id });
    const foreignAdvance = await insertAdvance(t.prisma, { workerId: foreign.worker.id, periodId: theirs.period.id, bankAccountId: foreign.account!.id });
    const body = { category: 'OTHER', title: 'Revisar', description: 'Detalle del caso' };
    const count = () => t.prisma.incident.count();

    const before = await count();
    const byWorker = await t.post('/company/incidents', admin).send({ ...body, workerId: foreign.worker.id });
    expect(byWorker.status).toBe(404);
    const byAdvance = await t.post('/company/incidents', admin).send({ ...body, advanceId: foreignAdvance.id });
    expect(byAdvance.status).toBe(404);
    expect(await count()).toBe(before);

    const ok = await t.post('/company/incidents', admin).send({ ...body, workerId: own.worker.id, advanceId: ownAdvance.id });
    expect(ok.status).toBe(201);
    expect(ok.body.companyId).toBe(mine.company.id);
    expect(await count()).toBe(before + 1);
  });
});

describe('company advance detail masks the bank number', () => {
  const FULL = '9876543210123';
  const mask = (n: string) => `****${n.slice(-4)}`;

  async function setup() {
    // 100.000 and above waits for the company, so the worker can leave advances in EXCEPTION.
    const fx = await createCompany(t.prisma, { settings: { exceptionAmount: 100_000 } });
    return { fx, admin: t.tokenFor(fx.admin), finance: t.tokenFor(fx.finance) };
  }
  async function requestAs(fx: Awaited<ReturnType<typeof setup>>['fx'], account: string, amount = 150_000) {
    const w = await createWorker(t.prisma, fx.company.id, { account });
    const res = await t.post('/worker/advances', t.tokenFor(w.user!, w.worker.id)).send({ amount, acknowledgeWarnings: true });
    expect(res.status).toBe(201);
    return res.body as { id: string; status: string };
  }

  it('GET /company/advances/:id and approve', async () => {
    const { fx, admin, finance } = await setup();
    const advance = await requestAs(fx, FULL);
    expect(advance.status).toBe('EXCEPTION');

    for (const token of [admin, finance]) {
      const detail = await t.get(`/company/advances/${advance.id}`, token);
      expect(detail.status).toBe(200);
      expect(detail.body.bankAccount.number).toBe(mask(FULL));
      expect(JSON.stringify(detail.body)).not.toContain(FULL);
    }

    const approved = await t.post(`/company/advances/${advance.id}/approve`, admin).send({ note: 'revisado' });
    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe('DISBURSED');
    expect(approved.body.bankAccount.number).toBe(mask(FULL));
    expect(JSON.stringify(approved.body)).not.toContain(FULL);
  });

  it('reject', async () => {
    const { fx, admin } = await setup();
    const account = '5550001111';
    const advance = await requestAs(fx, account);
    const rejected = await t.post(`/company/advances/${advance.id}/reject`, admin).send({ note: 'no cumple' });
    expect(rejected.status).toBe(201);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.bankAccount.number).toBe(mask(account));
    expect(JSON.stringify(rejected.body)).not.toContain(account);
  });

  it('retry', async () => {
    const { fx, admin } = await setup();
    const account = badAccount();
    const advance = await requestAs(fx, account, 60_000);
    expect(advance.status).toBe('FAILED');
    // The account is still bad, so the retry fails again, but the body must stay masked either way.
    const retried = await t.post(`/company/advances/${advance.id}/retry`, admin);
    expect(retried.status).toBe(201);
    expect(retried.body.bankAccount.number).toBe('****0000');
    expect(JSON.stringify(retried.body)).not.toContain(account);
  });

  it('does not show an advance of another company', async () => {
    const [a, b] = [await setup(), await setup()];
    const advance = await requestAs(a.fx, FULL);
    expect((await t.get(`/company/advances/${advance.id}`, b.admin)).status).toBe(404);
  });
});

describe('team', () => {
  it('a deactivated user loses the session they already had, and gets it back when reactivated', async () => {
    const fx = await createCompany(t.prisma);
    const admin = t.tokenFor(fx.admin);
    const financeToken = t.tokenFor(fx.finance);
    expect((await t.get('/company/settings', financeToken)).status).toBe(200);

    expect((await t.patch(`/company/team/${fx.finance.id}`, admin).send({ active: false })).status).toBe(200);
    expect((await t.get('/company/settings', financeToken)).status).toBe(401);
    expect((await t.post('/auth/login').send({ email: fx.finance.email, password: PASSWORD })).status).toBe(401);

    expect((await t.patch(`/company/team/${fx.finance.id}`, admin).send({ active: true })).status).toBe(200);
    expect((await t.get('/company/settings', financeToken)).status).toBe(200);
  });

  it('validates the body, protects the own user and only touches staff of the company', async () => {
    const [fx, other] = [await createCompany(t.prisma), await createCompany(t.prisma)];
    const admin = t.tokenFor(fx.admin);
    const worker = await createWorker(t.prisma, fx.company.id);
    const patch = (id: string, body: object, token = admin) => t.patch(`/company/team/${id}`, token).send(body);

    expect((await patch(fx.finance.id, {})).status).toBe(400);
    expect((await patch(fx.finance.id, { active: 'yes' })).status).toBe(400);
    expect((await patch(fx.admin.id, { active: false })).status).toBe(400);
    expect((await patch(worker.user!.id, { active: false })).status).toBe(404);
    expect((await patch(other.finance.id, { active: false })).status).toBe(404);
    expect((await patch(fx.admin.id, { active: false }, t.tokenFor(fx.finance))).status).toBe(403);
    // The worker's user was not deactivated by the 404.
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: worker.user!.id } })).active).toBe(true);
  });
});

describe('POST /company/workers/access (bulk)', () => {
  it('validates the body and handles an empty list', async () => {
    const fx = await createCompany(t.prisma);
    const admin = t.tokenFor(fx.admin);
    const post = (body: object) => t.post('/company/workers/access', admin).send(body);

    for (const body of [
      { enabled: true },
      { ids: 'abc', enabled: true },
      { ids: [1, 2], enabled: true },
      { ids: [null], enabled: true },
      { ids: Array.from({ length: 501 }, (_, i) => `id${i}`), enabled: true },
      { ids: ['x'], enabled: 'true' },
      { ids: ['x'] },
    ])
      expect((await post(body)).status, JSON.stringify(body).slice(0, 60)).toBe(400);

    const empty = await post({ ids: [], enabled: true });
    expect(empty.status).toBe(201);
    expect(empty.body).toEqual({ updated: 0, errors: [] });
  });

  it('toggles real workers and reports the ones it cannot', async () => {
    const [fx, other] = [await createCompany(t.prisma), await createCompany(t.prisma)];
    const mine = await createWorker(t.prisma, fx.company.id);
    const foreign = await createWorker(t.prisma, other.company.id);
    const res = await t.post('/company/workers/access', t.tokenFor(fx.admin)).send({ ids: [mine.worker.id, foreign.worker.id], enabled: false, reason: 'Fin de contrato' });
    expect(res.status).toBe(201);
    expect(res.body.updated).toBe(1);
    expect(res.body.errors).toEqual([expect.objectContaining({ id: foreign.worker.id })]);
    expect((await t.prisma.worker.findUniqueOrThrow({ where: { id: mine.worker.id } })).enabled).toBe(false);
    expect((await t.prisma.worker.findUniqueOrThrow({ where: { id: foreign.worker.id } })).enabled).toBe(true);
  });
});

describe('workers', () => {
  it('stores the cédula as digits, so the worker can register and log in with it', async () => {
    const fx = await createCompany(t.prisma);
    const admin = t.tokenFor(fx.admin);
    const doc = randomDoc();
    const email = `nuevo.${uid()}@example.com`;
    const body = { docNumber: dotted(doc), docType: 'CC', firstName: 'Ana', lastName: 'Prueba', email, baseSalary: 1_800_000 };

    const created = await t.post('/company/workers', admin).send(body);
    expect(created.status).toBe(201);
    expect(created.body.docNumber).toBe(doc);
    // The dotted spelling is the same worker.
    expect((await t.post('/company/workers', admin).send(body)).status).toBe(409);

    const done = await t.post('/auth/register').send({ docNumber: dotted(doc), email, password: PASSWORD });
    expect(done.status).toBe(201);
    for (const id of [doc, dotted(doc)]) {
      const login = await t.post('/auth/login').send({ email: id, password: PASSWORD });
      expect(login.status).toBe(201);
      expect(login.body.user.workerId).toBe(created.body.id);
    }
  });

  it('Finance cannot create workers', async () => {
    const fx = await createCompany(t.prisma);
    const res = await t.post('/company/workers', t.tokenFor(fx.finance)).send({ docNumber: randomDoc(), firstName: 'A', lastName: 'B', email: `a.${uid()}@example.com`, baseSalary: 1_500_000 });
    expect(res.status).toBe(403);
  });
});

describe('POST /company/workers/upload', () => {
  const upload = (token: string, file: Buffer, filename = 'trabajadores.csv') =>
    t.post('/company/workers/upload', token).attach('file', file, { filename, contentType: 'text/csv' });
  const header = 'documento,nombres,apellidos,correo,salario';
  const row = (doc: string, salary = '1.800.000') => `${doc},Ana,Prueba,ana.${uid()}@example.com,${salary}`;

  it('rejects a non-CSV file, binary content, an oversized file and too many rows', async () => {
    const fx = await createCompany(t.prisma);
    const admin = t.tokenFor(fx.admin);

    const xlsx = await upload(admin, Buffer.from(`${header}\n${row(randomDoc())}`), 'trabajadores.xlsx');
    expect(xlsx.status).toBe(400);
    // Rejected by the shared csvUpload filter (same as payroll); a renamed binary still hits the NUL check below.
    expect(xlsx.body.message).toBe('Solo se aceptan archivos CSV de hasta 5 MB');
    const binary = await upload(admin, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x2c, 0x0a]));
    expect(binary.status).toBe(400);
    expect(binary.body.message).toBe('El archivo debe ser un CSV');
    expect((await upload(admin, Buffer.alloc(5 * 1024 * 1024 + 1024, 0x61))).status).toBe(413);

    const many = [header, ...Array.from({ length: 5001 }, (_, i) => row(String(2_000_000_000 + i)))].join('\n');
    const tooMany = await upload(admin, Buffer.from(many));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/5000/);
    expect(await t.prisma.worker.count({ where: { companyId: fx.company.id } })).toBe(0);
  });

  it('imports the good rows and reports the bad document row', async () => {
    const fx = await createCompany(t.prisma);
    const [one, two] = [randomDoc(), randomDoc()];
    const res = await upload(t.tokenFor(fx.admin), Buffer.from([header, row(dotted(one)), row('abc'), row(two)].join('\n')));
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
    expect(res.body.errors).toEqual([{ row: 3, message: expect.any(String) }]);
    const stored = await t.prisma.worker.findMany({ where: { companyId: fx.company.id }, orderBy: { docNumber: 'asc' } });
    expect(stored.map((w) => w.docNumber).sort()).toEqual([one, two].sort());
    expect(stored.every((w) => w.baseSalary === 1_800_000)).toBe(true);
  });
});
