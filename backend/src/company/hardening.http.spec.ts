import { ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthGuard } from '../common/auth.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EarningsService } from '../ewa/earnings.service.js';
import { AdvancesService } from '../ewa/advances.service.js';
import { OnboardingService } from '../ewa/worker.controller.js';
import { CompanyController } from './company.controller.js';
import { SupportController } from '../support/support.controller.js';
import { AdminController } from '../admin/admin.controller.js';
import { AnalyticsController } from '../analytics/analytics.controller.js';

// Wires the real controllers, guard, ValidationPipe and multer over a fake Prisma, so DTO validation, roles and
// upload limits are exercised through HTTP exactly as the app does (no database needed).

const stored = { id: 's1', companyId: 'c1', maxAdvancePct: 50, recommendedPct: 25, minAmount: 20_000, maxAmountPerRequest: 1_000_000 };
const users = {
  admin: { id: 'u-admin', role: 'COMPANY_ADMIN', companyId: 'c1', workerId: null },
  finance: { id: 'u-fin', role: 'COMPANY_FINANCE', companyId: 'c1', workerId: null },
  worker: { id: 'u-worker', role: 'WORKER', companyId: 'c1', workerId: 'w1' },
  flexa: { id: 'u-flexa', role: 'FLEXA_ADMIN', companyId: null, workerId: null },
} as const;

const period = { id: 'p1', companyId: 'c1', label: 'P', status: 'OPEN', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30'), payDate: new Date('2026-11-30'), budget: null };

const prisma = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => Object.values(users).find((u) => u.id === where.id) && { active: true, ...Object.values(users).find((u) => u.id === where.id)! }),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  worker: { findFirst: vi.fn(), findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }) => ({ id: 'w-new', ...data })), update: vi.fn(async ({ data }) => ({ id: 'w-old', ...data })), findMany: vi.fn(async () => []) },
  site: { findMany: vi.fn(async () => []), findFirst: vi.fn() },
  incident: { findMany: vi.fn(async () => []) },
  advance: { findMany: vi.fn(async () => []) },
  company: { findUnique: vi.fn(async () => ({ id: 'c1' })) },
  companySettings: { upsert: vi.fn(async () => stored), update: vi.fn(async ({ data }) => ({ ...stored, ...data })) },
  supportTicket: {
    findFirst: vi.fn(async () => ({ id: 't1', status: 'OPEN', user: { role: 'WORKER', companyId: 'c1' }, messages: [] })),
    findMany: vi.fn(async () => []),
    update: vi.fn(),
  },
  ticketMessage: { create: vi.fn(async ({ data }) => ({ id: 'm1', ...data })) },
  auditLog: { findMany: vi.fn(async () => []) },
  payrollPeriod: { findFirst: vi.fn(async () => period), findMany: vi.fn(async () => []) },
  servicePayment: { findMany: vi.fn(async () => []) },
};

let app: INestApplication;
let jwt: JwtService;
const as = (who: keyof typeof users) => `Bearer ${jwt.sign({ sub: users[who].id, role: users[who].role, name: who, companyId: users[who].companyId, workerId: users[who].workerId })}`;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [JwtModule.register({ global: true, secret: 'test-secret-0123456789', signOptions: { expiresIn: '1h' } })],
    controllers: [CompanyController, SupportController, AdminController, AnalyticsController],
    providers: [
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: vi.fn() } },
      { provide: EarningsService, useValue: { settings: vi.fn(async () => stored), currentPeriod: vi.fn(async () => null) } },
      { provide: AdvancesService, useValue: {} },
      { provide: OnboardingService, useValue: { refresh: vi.fn() } },
    ],
  }).compile();
  app = mod.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  jwt = mod.get(JwtService);
});

afterAll(() => app.close());

describe('PATCH /company/settings', () => {
  it('rejects a partial update that breaks a cross-field rule against stored values', async () => {
    const res = await request(app.getHttpServer()).patch('/company/settings').set('Authorization', as('admin')).send({ maxAdvancePct: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El recomendado no puede superar el tope');
    expect(prisma.companySettings.update).not.toHaveBeenCalled();
  });

  it('stores a valid partial update with only the sent keys', async () => {
    const res = await request(app.getHttpServer()).patch('/company/settings').set('Authorization', as('admin')).send({ feePerRequest: 250 });
    expect(res.status).toBe(200);
    expect(prisma.companySettings.update).toHaveBeenCalledWith({ where: { companyId: 'c1' }, data: { feePerRequest: 250 } });
  });

  it('rejects maxAdvancePct out of range and Finance', async () => {
    expect((await request(app.getHttpServer()).patch('/company/settings').set('Authorization', as('admin')).send({ maxAdvancePct: 500 })).status).toBe(400);
    expect((await request(app.getHttpServer()).patch('/company/settings').set('Authorization', as('finance')).send({ feePerRequest: 1 })).status).toBe(403);
  });
});

describe('PATCH /admin/companies/:id/settings', () => {
  it('validates through the DTO: range, types and cross-field rules', async () => {
    const send = (body: object) => request(app.getHttpServer()).patch('/admin/companies/c1/settings').set('Authorization', as('flexa')).send(body);
    expect((await send({ maxAdvancePct: 500 })).status).toBe(400);
    expect((await send({ maxAdvancePct: 10 })).status).toBe(400);
    expect((await send({ minAmount: 5_000_000 })).status).toBe(400);
    expect((await send({ feePerRequest: 'abc' })).status).toBe(400);
    expect((await send({ bogus: 1 })).body.message).toBe('Sin parámetros válidos');
    const ok = await send({ maxAdvancePct: 60, recommendedPct: 30 });
    expect(ok.status).toBe(200);
    expect(prisma.companySettings.update).toHaveBeenLastCalledWith({ where: { companyId: 'c1' }, data: { maxAdvancePct: 60, recommendedPct: 30 } });
  });

  it('is closed to company users', async () => {
    expect((await request(app.getHttpServer()).patch('/admin/companies/c1/settings').set('Authorization', as('admin')).send({ feePerRequest: 1 })).status).toBe(403);
  });
});

describe('PATCH /company/team/:id and POST /company/workers/access', () => {
  it('validates the toggle body', async () => {
    const patch = (body: object) => request(app.getHttpServer()).patch('/company/team/u-other').set('Authorization', as('admin')).send(body);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ active: 'yes' })).status).toBe(400);
    expect((await patch({ active: false })).status).toBe(200);
  });

  it('blocks self-deactivation and Finance', async () => {
    expect((await request(app.getHttpServer()).patch('/company/team/u-admin').set('Authorization', as('admin')).send({ active: false })).status).toBe(400);
    expect((await request(app.getHttpServer()).patch('/company/team/u-other').set('Authorization', as('finance')).send({ active: false })).status).toBe(403);
  });

  it('validates the bulk body: ids array, max 500, string items, boolean enabled', async () => {
    const post = (body: object) => request(app.getHttpServer()).post('/company/workers/access').set('Authorization', as('admin')).send(body);
    expect((await post({ enabled: true })).status).toBe(400);
    expect((await post({ ids: 'w1', enabled: true })).status).toBe(400);
    expect((await post({ ids: [1, 2], enabled: true })).status).toBe(400);
    expect((await post({ ids: ['w1'], enabled: 'true' })).status).toBe(400);
    expect((await post({ ids: Array.from({ length: 501 }, (_, i) => `w${i}`), enabled: true })).status).toBe(400);
    const ok = await post({ ids: [], enabled: true });
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ updated: 0, errors: [] });
  });
});

describe('POST /company/workers/upload', () => {
  const upload = (buf: Buffer, name: string) => request(app.getHttpServer()).post('/company/workers/upload').set('Authorization', as('admin')).attach('file', buf, name);

  it('rejects a non-CSV file with 400', async () => {
    const res = await upload(Buffer.from('documento,nombres\n1,Ana'), 'workers.xlsx');
    expect(res.status).toBe(400);
    // Same shared multer filter (csvUpload) as the payroll upload.
    expect(res.body.message).toBe('Solo se aceptan archivos CSV de hasta 5 MB');
  });

  it('rejects a file over 5 MB', async () => {
    const res = await upload(Buffer.alloc(5 * 1024 * 1024 + 1024, 'a'), 'big.csv');
    expect(res.status).toBe(413);
  });

  it('rejects more than 5000 rows with 400', async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => `${i + 1},Ana,Perez,a${i}@x.co,1500000`).join('\n');
    const res = await upload(Buffer.from(`documento,nombres,apellidos,correo,salario\n${rows}`), 'rows.csv');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('5000');
  });

  it('parses salaries as money: decimals are not inflated, unreadable values are rejected', async () => {
    const csv = 'documento,nombres,apellidos,correo,salario\n101,Ana,Perez,ana@x.co,1500000.40\n102,Luis,Rey,luis@x.co,$ 1.500.000\n103,Eva,Paz,eva@x.co,abc\n104,Leo,Gil,leo@x.co,0\n';
    const res = await upload(Buffer.from(csv), 'money.csv');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 2, updated: 0, errors: [{ row: 4, message: 'Salario inválido' }, { row: 5, message: 'Salario inválido' }] });
    const salaries = prisma.worker.create.mock.calls.slice(-2).map(([a]) => (a as { data: { baseSalary: number } }).data.baseSalary);
    expect(salaries).toEqual([1_500_000, 1_500_000]);
  });

  it('does not apply a salary more than 30 % away from the registered one', async () => {
    prisma.worker.findUnique.mockResolvedValue({ id: 'w-old', baseSalary: 1_000_000 } as never);
    try {
      prisma.worker.update.mockClear();
      const res = await upload(Buffer.from('documento,nombres,apellidos,correo,salario\n101,Ana,Perez,ana@x.co,1500000\n102,Luis,Rey,luis@x.co,1200000\n'), 'raise.csv');
      expect(res.status).toBe(201);
      expect(res.body.updated).toBe(1);
      expect(res.body.errors).toEqual([{ row: 2, message: expect.stringContaining('Variación mayor al 30 %') }]);
      expect(prisma.worker.update).toHaveBeenCalledTimes(1);
      expect(prisma.worker.update).toHaveBeenCalledWith({ where: { id: 'w-old' }, data: expect.objectContaining({ baseSalary: 1_200_000 }) });
    } finally {
      prisma.worker.findUnique.mockImplementation(async () => null);
    }
  });

  it('imports a CSV storing the cédula digits-only', async () => {
    const res = await upload(Buffer.from('documento,nombres,apellidos,correo,salario\n1.144.555.999,Ana,Perez,ana@x.co,1500000\n'), 'ok.csv');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 1, updated: 0, errors: [] });
    expect(prisma.worker.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ docNumber: '1144555999' }) });
  });
});

describe('query enums answer 400', () => {
  it('company, admin and support lists', async () => {
    const get = (url: string, who: keyof typeof users) => request(app.getHttpServer()).get(url).set('Authorization', as(who));
    expect((await get('/company/workers?status=BOGUS', 'admin')).status).toBe(400);
    expect((await get('/company/incidents?status=BOGUS', 'admin')).status).toBe(400);
    expect((await get('/company/advances?status=BOGUS', 'admin')).status).toBe(400);
    expect((await get('/admin/incidents?status=BOGUS', 'flexa')).status).toBe(400);
    expect((await get('/admin/advances?status=BOGUS', 'flexa')).status).toBe(400);
    expect((await get('/support/tickets?status=BOGUS', 'worker')).status).toBe(400);
    expect((await get('/company/incidents?status=OPEN', 'admin')).status).toBe(200);
    expect((await get('/support/tickets?status=OPEN', 'worker')).status).toBe(200);
  });
});

describe('support rules over HTTP', () => {
  const msg = (who: keyof typeof users) => request(app.getHttpServer()).post('/support/tickets/t1/messages').set('Authorization', as(who)).send({ body: 'hola' });
  const close = (who: keyof typeof users) => request(app.getHttpServer()).patch('/support/tickets/t1/status').set('Authorization', as(who)).send({ status: 'CLOSED' });

  it('Finance cannot reply, company admin can', async () => {
    expect((await msg('finance')).status).toBe(403);
    expect((await msg('admin')).status).toBe(201);
  });

  it('company staff cannot close a worker ticket; worker and FLEXA can', async () => {
    expect((await close('admin')).status).toBe(403);
    expect((await close('finance')).status).toBe(403);
    expect((await close('worker')).status).toBe(200);
    expect((await close('flexa')).status).toBe(200);
  });
});

describe('analytics numeric query params', () => {
  it('clamps absurd limits instead of failing', async () => {
    const get = (url: string) => request(app.getHttpServer()).get(url).set('Authorization', as('finance'));
    expect((await get('/analytics/usage?months=999999999')).status).toBe(200);
    expect((await get('/analytics/usage?months=-4')).status).toBe(200);
    expect((await get('/analytics/trends?limit=-5')).status).toBe(200);
    expect(prisma.payrollPeriod.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 1 }));
    expect((await get('/analytics/trends?limit=9999')).status).toBe(200);
    expect(prisma.payrollPeriod.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 24 }));
  });
});
