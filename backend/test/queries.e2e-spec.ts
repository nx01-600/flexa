import { bootApp, type TestApp } from './helpers/app.js';
import { createCompany, createFlexaAdmin, createWorker } from './helpers/fixtures.js';

let t: TestApp;
let tokens: { admin: string; finance: string; worker: string; flexa: string };

beforeAll(async () => {
  t = await bootApp();
  const fx = await createCompany(t.prisma);
  const w = await createWorker(t.prisma, fx.company.id);
  tokens = {
    admin: t.tokenFor(fx.admin),
    finance: t.tokenFor(fx.finance),
    worker: t.tokenFor(w.user!, w.worker.id),
    flexa: t.tokenFor(await createFlexaAdmin(t.prisma)),
  };
});
afterAll(() => t.app.close());

describe('enum query parameters', () => {
  // [path, token, a valid value]
  const cases = [
    ['/company/workers', 'admin', 'ACTIVE'],
    ['/company/incidents', 'admin', 'OPEN'],
    ['/company/advances', 'admin', 'DISBURSED'],
    ['/admin/incidents', 'flexa', 'ESCALATED'],
    ['/admin/advances', 'flexa', 'FAILED'],
    ['/support/tickets', 'worker', 'WAITING_USER'],
  ] as const;

  it.each(cases)('GET %s?status=BOGUS is a 400, never a 500', async (path, who) => {
    for (const bogus of ['BOGUS', 'active', 'DROP TABLE']) {
      const res = await t.get(`${path}?status=${encodeURIComponent(bogus)}`, tokens[who]);
      expect(res.status, bogus).toBe(400);
    }
  });

  it.each(cases)('GET %s?status=<valid> is a 200', async (path, who, status) => {
    expect((await t.get(`${path}?status=${status}`, tokens[who])).status).toBe(200);
    expect((await t.get(path, tokens[who])).status).toBe(200);
  });

  it('Finance reads the same lists', async () => {
    expect((await t.get('/company/advances?status=FAILED', tokens.finance)).status).toBe(200);
    expect((await t.get('/company/advances?status=BOGUS', tokens.finance)).status).toBe(400);
  });
});

describe('date query parameters', () => {
  it('an unreadable date is a 400, a readable one is a 200', async () => {
    expect((await t.get('/company/advances?from=not-a-date', tokens.admin)).status).toBe(400);
    expect((await t.get('/company/advances?to=31/31/2026', tokens.admin)).status).toBe(400);
    expect((await t.get('/company/advances?from=2026-01-01&to=2026-12-31', tokens.admin)).status).toBe(200);
  });
});

describe('analytics numeric parameters', () => {
  it('absurd values are clamped, not an error', async () => {
    for (const path of ['/analytics/usage?months=999999999', '/analytics/usage?months=-3', '/analytics/usage?months=abc', '/analytics/trends?limit=-5', '/analytics/trends?limit=999999']) {
      expect((await t.get(path, tokens.admin)).status, path).toBe(200);
    }
  });
});
