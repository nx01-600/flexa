import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { bootApp, type TestApp } from './helpers/app.js';
import { createCompany, createWorker, dotted, PASSWORD, randomDoc, uid } from './helpers/fixtures.js';

let t: TestApp;

beforeAll(async () => {
  t = await bootApp();
});
afterAll(() => t.app.close());

describe('register', () => {
  it('creates the session in one step, with the cédula and email normalized', async () => {
    const fx = await createCompany(t.prisma);
    const doc = randomDoc();
    // Stored with mixed case, requested in upper case and with dots: both sides are normalized.
    const stored = `Ana.${uid()}@Example.COM`;
    const { worker } = await createWorker(t.prisma, fx.company.id, { registered: false, docNumber: doc, email: stored });

    const short = await t.post('/auth/register').send({ docNumber: dotted(doc), email: stored, password: '1234567' });
    expect(short.status).toBe(400);
    expect(await t.prisma.user.findUnique({ where: { email: stored.toLowerCase() } })).toBeNull();

    const done = await t.post('/auth/register').send({ docNumber: dotted(doc), email: stored.toUpperCase(), password: PASSWORD, phone: '3001112233' });
    expect(done.status).toBe(201);
    expect(done.body.user).toMatchObject({ role: 'WORKER', workerId: worker.id });
    const after = await t.prisma.worker.findUniqueOrThrow({ where: { id: worker.id } });
    expect(after.status).toBe('PENDING_KYC');
    expect(after.userId).toBeTruthy();
    expect(after.phone).toBe('3001112233');
    expect((await t.get('/auth/me', done.body.accessToken)).status).toBe(200);

    const again = await t.post('/auth/register').send({ docNumber: doc, email: stored, password: PASSWORD });
    expect(again.status).toBe(409);
  });

  it('keeps the specific errors for unknown, disabled and email-in-use cases', async () => {
    const fx = await createCompany(t.prisma);
    const disabled = await createWorker(t.prisma, fx.company.id, { registered: false, enabled: false });
    const taken = await createWorker(t.prisma, fx.company.id, { registered: false });
    await t.prisma.user.create({ data: { email: taken.worker.email.toLowerCase(), name: 'Other', role: 'WORKER', passwordHash: 'x' } });

    const unknown = await t.post('/auth/register').send({ docNumber: randomDoc(), email: `nobody.${uid()}@example.com`, password: PASSWORD });
    expect(unknown.status).toBe(404);
    const off = await t.post('/auth/register').send({ docNumber: disabled.worker.docNumber, email: disabled.worker.email, password: PASSWORD });
    expect(off.status).toBe(401);
    const inUse = await t.post('/auth/register').send({ docNumber: taken.worker.docNumber, email: taken.worker.email, password: PASSWORD });
    expect(inUse.status).toBe(409);
  });
});

describe('login', () => {
  it('a cédula registered in two companies asks for the email; the email works', async () => {
    const [a, b] = [await createCompany(t.prisma), await createCompany(t.prisma)];
    const doc = randomDoc();
    const wa = await createWorker(t.prisma, a.company.id, { docNumber: doc });
    await createWorker(t.prisma, b.company.id, { docNumber: doc });

    const byDoc = await t.post('/auth/login').send({ email: doc, password: PASSWORD });
    expect(byDoc.status).toBe(400);
    expect(byDoc.body.message).toMatch(/correo electrónico/);

    const byEmail = await t.post('/auth/login').send({ email: wa.user!.email, password: PASSWORD });
    expect(byEmail.status).toBe(201);
    expect(byEmail.body.user).toMatchObject({ role: 'WORKER', workerId: wa.worker.id });
  });

  it('a cédula stored with dots logs in with dots or plain digits', async () => {
    const fx = await createCompany(t.prisma);
    const doc = randomDoc();
    const w = await createWorker(t.prisma, fx.company.id, { docNumber: dotted(doc) });
    for (const id of [doc, dotted(doc)]) {
      const res = await t.post('/auth/login').send({ email: id, password: PASSWORD, surface: 'worker' });
      expect(res.status).toBe(201);
      expect(res.body.user.workerId).toBe(w.worker.id);
    }
  });

  it('rejects a wrong password, an inactive user and the wrong surface', async () => {
    const fx = await createCompany(t.prisma);
    const w = await createWorker(t.prisma, fx.company.id);
    expect((await t.post('/auth/login').send({ email: w.user!.email, password: 'nope-nope' })).status).toBe(401);
    expect((await t.post('/auth/login').send({ email: w.user!.email, password: PASSWORD, surface: 'admin' })).status).toBe(401);
    await t.prisma.user.update({ where: { id: w.user!.id }, data: { active: false } });
    expect((await t.post('/auth/login').send({ email: w.user!.email, password: PASSWORD })).status).toBe(401);
  });

  it('logs in the seeded demo accounts', async () => {
    const demo = [
      ['1234567890', 'WORKER'],
      ['rrhh@empresa.com', 'COMPANY_ADMIN'],
      ['finanzas@empresa.com', 'COMPANY_FINANCE'],
      ['admin@flexa.co', 'FLEXA_ADMIN'],
    ] as const;
    for (const [id, role] of demo) {
      const res = await t.post('/auth/login').send({ email: id, password: PASSWORD });
      expect(res.status, id).toBe(201);
      expect(res.body.user.role).toBe(role);
      expect((await t.get('/auth/me', res.body.accessToken)).status).toBe(200);
    }
  });
});

describe('session tokens follow the account', () => {
  it('stop working as soon as the user is deactivated or changes role or company, and work again when restored', async () => {
    const [a, b] = [await createCompany(t.prisma), await createCompany(t.prisma)];
    const token = t.tokenFor(a.finance);
    const me = () => t.get('/auth/me', token);
    expect((await me()).status).toBe(200);

    await t.prisma.user.update({ where: { id: a.finance.id }, data: { active: false } });
    expect((await me()).status).toBe(401);
    await t.prisma.user.update({ where: { id: a.finance.id }, data: { active: true } });
    expect((await me()).status).toBe(200);

    await t.prisma.user.update({ where: { id: a.finance.id }, data: { role: 'COMPANY_ADMIN' } });
    expect((await me()).status).toBe(401);
    await t.prisma.user.update({ where: { id: a.finance.id }, data: { role: 'COMPANY_FINANCE' } });
    expect((await me()).status).toBe(200);

    await t.prisma.user.update({ where: { id: a.finance.id }, data: { companyId: b.company.id } });
    expect((await me()).status).toBe(401);
    await t.prisma.user.update({ where: { id: a.finance.id }, data: { companyId: a.company.id } });
    expect((await me()).status).toBe(200);
  });

  it('requires a token on protected routes and leaves health public', async () => {
    expect((await t.get('/auth/me')).status).toBe(401);
    expect((await t.get('/worker/earnings', 'garbage')).status).toBe(401);
    expect((await t.get('/health')).status).toBe(200);
  });
});

describe('JWT secret at startup', () => {
  async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<unknown>) {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }
  const compile = () => Test.createTestingModule({ imports: [AppModule] }).compile();

  it.each([
    ['missing', undefined],
    ['shorter than 16 characters', 'too-short'],
  ])('refuses to start when the secret is %s', async (_label, secret) => {
    await withEnv({ JWT_SECRET: secret }, async () => {
      await expect(compile()).rejects.toThrow(/JWT_SECRET/);
    });
  });

  it.each(['dev-only-secret-change-before-deploying', 'cambia-esto-en-produccion'])('refuses the placeholder "%s" in production', async (secret) => {
    await withEnv({ JWT_SECRET: secret, NODE_ENV: 'production' }, async () => {
      await expect(compile()).rejects.toThrow(/JWT_SECRET/);
    });
  });

  it('starts in production with a real secret', async () => {
    await withEnv({ NODE_ENV: 'production' }, async () => {
      const mod = await compile();
      await mod.close();
    });
  });
});
