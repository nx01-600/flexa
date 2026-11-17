import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuditService } from '../common/audit.service.js';
import { ROLES } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompensationController } from './compensation.controller.js';
import { PayrollController, PayrollService } from './payroll.controller.js';

// HTTP-level checks: DTO validation, upload filter/limit and role metadata, with a fake Prisma behind the controllers.
describe('payroll and compensation over HTTP', () => {
  let app: INestApplication;
  const ingest = vi.fn(async (..._args: unknown[]) => ({ id: 'up1' }));
  const prisma = {
    payrollPeriod: {
      updateMany: vi.fn(async (..._args: unknown[]) => ({ count: 1 })),
      findFirst: vi.fn(async (..._args: unknown[]) => ({ id: 'p1', companyId: 'c1', status: 'CLOSED', label: 'Nov' })),
    },
    company: { findUnique: vi.fn(async (..._args: unknown[]) => ({ id: 'c1', erpName: 'SAP' })), update: vi.fn(async (..._args: unknown[]) => ({})) },
    compensationLine: { findMany: vi.fn(async (..._args: unknown[]) => []), update: vi.fn(async (..._args: unknown[]) => ({})) },
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [PayrollController, CompensationController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: vi.fn(async () => undefined) } },
        { provide: PayrollService, useValue: { ingest } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // Stand-in for AuthGuard: always a company admin of c1.
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { sub: 'u1', role: 'COMPANY_ADMIN', name: 'Admin', companyId: 'c1', workerId: null };
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('PATCH budget is COMPANY_ADMIN only (Finance is read-only)', () => {
    const roles = new Reflector().get<string[]>(ROLES, PayrollController.prototype.budget);
    expect(roles).toEqual(['COMPANY_ADMIN']);
  });

  it('PATCH budget validates the body through the DTO', async () => {
    const http = request(app.getHttpServer());
    for (const body of [{}, { budget: 'mucho' }, { budget: -1 }, { budget: 1.5 }]) await http.patch('/payroll/periods/p1/budget').send(body).expect(400);
    expect(prisma.payrollPeriod.updateMany).not.toHaveBeenCalled();
    await http.patch('/payroll/periods/p1/budget').send({ budget: 5_000_000 }).expect(200);
    expect(prisma.payrollPeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { budget: 5_000_000n } }));
  });

  it('upload accepts a small CSV and hands the parsed rows to ingest', async () => {
    await request(app.getHttpServer())
      .post('/payroll/periods/p1/upload')
      .attach('file', Buffer.from('documento,salario\n1001,"1.500.000"\n'), { filename: 'nomina.csv', contentType: 'text/csv' })
      .expect(201);
    expect(ingest).toHaveBeenCalledWith('c1', 'p1', [{ documento: '1001', salario: '1.500.000' }], 'FILE', 'nomina.csv', 'u1');
  });

  it('upload rejects non-CSV files with 400 and does not ingest', async () => {
    const http = request(app.getHttpServer());
    await http.post('/payroll/periods/p1/upload').attach('file', Buffer.from('x'), { filename: 'nomina.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }).expect(400);
    await http.post('/payroll/periods/p1/upload').attach('file', Buffer.from('x'), { filename: 'nomina.csv', contentType: 'image/png' }).expect(400);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('upload rejects a file over 5 MB', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');
    const res = await request(app.getHttpServer()).post('/payroll/periods/p1/upload').attach('file', big, { filename: 'nomina.csv', contentType: 'text/csv' });
    expect(res.status).toBe(413);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('compensation applied has the same file filter and validates items', async () => {
    const http = request(app.getHttpServer());
    await http.post('/compensation/periods/p1/applied').attach('file', Buffer.from('x'), { filename: 'x.pdf', contentType: 'application/pdf' }).expect(400);
    await http.post('/compensation/periods/p1/applied').send({ items: [{ docNumber: '1001' }] }).expect(400);
    await http.post('/compensation/periods/p1/applied').send({ items: [{ docNumber: '1001', amount: 'mucho' }] }).expect(400);
    expect(prisma.compensationLine.update).not.toHaveBeenCalled();
  });

  it('ERP sync passes JSON numbers through untouched and rejects non-object entries', async () => {
    const http = request(app.getHttpServer());
    await http.post('/payroll/erp/sync').set('x-api-key', 'k').send({ entries: [null] }).expect(400);
    await http.post('/payroll/erp/sync').set('x-api-key', 'k').send({ periodId: 'p1', entries: [{ Documento: 1001, Salario: 1_500_000.5 }] }).expect(201);
    expect(ingest.mock.calls[0][2]).toEqual([{ documento: 1001, salario: 1_500_000.5 }]);
  });
});
