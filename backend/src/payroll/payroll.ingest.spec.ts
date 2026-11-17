import { PayrollService } from './payroll.controller.js';

const period = { id: 'p1', companyId: 'c1', status: 'OPEN', label: 'Nov 2026', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30') };
const worker = (id: string, doc: string, baseSalary = 1_500_000) => ({
  id,
  docNumber: doc,
  baseSalary,
  enabled: true,
  status: 'ACTIVE',
  firstName: `W${id}`,
  lastName: 'Test',
});

const mock = <T>(v: T) => vi.fn(async (..._args: unknown[]) => v);

// Minimal in-memory stand-in for the Prisma calls ingest() makes.
function setup(workers = [worker('w1', '1001'), worker('w2', '1002')], overrides: Record<string, unknown> = {}) {
  const prisma = {
    payrollPeriod: { findFirst: mock(period) },
    payrollUpload: {
      create: vi.fn(async (..._args: unknown[]) => ({ id: 'up1' })),
      update: vi.fn(async (..._args: unknown[]) => ({})),
      findUnique: vi.fn(async (..._args: unknown[]) => ({ id: 'up1' })),
    },
    worker: { findMany: mock(workers), update: vi.fn(async (..._args: unknown[]) => ({})) },
    payrollEntry: { upsert: vi.fn(async (..._args: unknown[]) => ({})) },
    payrollIssue: { createMany: vi.fn(async (..._args: unknown[]) => ({})), create: vi.fn(async (..._args: unknown[]) => ({})) },
    company: { update: vi.fn(async (..._args: unknown[]) => ({})) },
    incident: { create: vi.fn(async (..._args: unknown[]) => ({})) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
  const audit = { log: mock(undefined) };
  const service = new PayrollService(prisma as never, audit as never);
  const issuesOf = () => (prisma.payrollIssue.createMany.mock.calls[0]?.[0] as { data: { row: number; field: string; message: string; severity: string }[] } | undefined)?.data ?? [];
  const finalStatus = () => (prisma.payrollUpload.update.mock.calls.at(-1)?.[0] as { data: { status: string } }).data.status;
  return { prisma, service, issuesOf, finalStatus };
}

const ingest = (service: PayrollService, rows: Record<string, unknown>[], source: 'FILE' | 'ERP_API' = 'FILE') => service.ingest('c1', 'p1', rows, source, 'nomina.csv', 'u1');

describe('PayrollService.ingest', () => {
  it('applies a valid row and reads Colombian number formats correctly', async () => {
    const { prisma, service, issuesOf, finalStatus } = setup();
    await ingest(service, [
      { documento: '1001', salario: '$1.500.000', dias_trabajados: '15' },
      { documento: '1002', salario: '1500000,50', dias_trabajados: '15' },
    ]);
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledTimes(2);
    const first = prisma.payrollEntry.upsert.mock.calls[0][0] as { update: { baseSalary: number } };
    const second = prisma.payrollEntry.upsert.mock.calls[1][0] as { update: { baseSalary: number } };
    expect(first.update.baseSalary).toBe(1_500_000);
    expect(second.update.baseSalary).toBe(1_500_001); // never x10 / x100, always an integer
    expect(issuesOf().filter((i) => i.severity === 'ERROR')).toEqual([]);
    expect(finalStatus()).toBe('PROCESSED');
  });

  it('keeps fractional overtime hours', async () => {
    const { prisma, service } = setup();
    await ingest(service, [{ documento: '1001', salario: '1500000', horas_extra: '2,5', valor_horas_extra: '30000' }]);
    expect((prisma.payrollEntry.upsert.mock.calls[0][0] as { update: { overtimeHours: number } }).update.overtimeHours).toBe(2.5);
  });

  it('rejects a salary more than 30 % away: ERROR, not applied, registered salary untouched', async () => {
    const { prisma, service, issuesOf, finalStatus } = setup();
    await ingest(service, [
      { documento: '1001', salario: '15.000.000' },
      { documento: '1002', salario: '1.600.000' },
    ]);
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledTimes(1);
    expect((prisma.payrollEntry.upsert.mock.calls[0][0] as { where: { periodId_workerId: { workerId: string } } }).where.periodId_workerId.workerId).toBe('w2');
    // Only the in-range row may move the registered salary.
    expect(prisma.worker.update).toHaveBeenCalledTimes(1);
    expect(prisma.worker.update.mock.calls[0][0]).toMatchObject({ where: { id: 'w2' }, data: { baseSalary: 1_600_000 } });
    const issue = issuesOf().find((i) => i.field === 'salario');
    expect(issue).toMatchObject({ row: 2, severity: 'ERROR' });
    expect(issue!.message).toContain('30 %');
    // The rejected worker is not additionally reported as missing from the file.
    expect(issuesOf().some((i) => i.severity === 'WARNING' && i.row === 0)).toBe(false);
    expect(finalStatus()).toBe('WITH_ISSUES');
  });

  it('flags salary 0, missing, negative and unreadable values as ERROR rows instead of failing', async () => {
    const { prisma, service, issuesOf } = setup([worker('w1', '1001'), worker('w2', '1002'), worker('w3', '1003'), worker('w4', '1004'), worker('w5', '1005')]);
    await ingest(service, [
      { documento: '1001', salario: '0' },
      { documento: '1002', salario: '' },
      { documento: '1003', salario: '-1.500.000' },
      { documento: '1004', salario: 'abc' },
      { documento: '1005', salario: '1500000', recargos: 'x1' },
    ]);
    expect(prisma.payrollEntry.upsert).not.toHaveBeenCalled();
    const errors = issuesOf().filter((i) => i.severity === 'ERROR');
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
    expect(errors.map((e) => e.message)).toEqual(['El salario debe ser mayor a 0', 'Salario faltante', 'Valor inválido', 'Valor inválido', 'Valor inválido']);
  });

  it('requires workedDays to be an integer within the period', async () => {
    const { prisma, service, issuesOf } = setup([worker('w1', '1001'), worker('w2', '1002'), worker('w3', '1003'), worker('w4', '1004')]);
    await ingest(service, [
      { documento: '1001', salario: '1500000', dias_trabajados: '31' }, // period has 30 days
      { documento: '1002', salario: '1500000', dias_trabajados: '15,5' },
      { documento: '1003', salario: '1500000', dias_trabajados: '-1' },
      { documento: '1004', salario: '1500000', dias_trabajados: '30' },
    ]);
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledTimes(1);
    expect(issuesOf().filter((i) => i.field === 'dias_trabajados').map((i) => i.row)).toEqual([2, 3, 4]);
  });

  it('uses ERP JSON numbers as numbers', async () => {
    const { prisma, service, finalStatus } = setup();
    await ingest(
      service,
      [
        { documento: 1001, salario: 1_500_000, dias_trabajados: 20, horas_extra: 3.5, valor_horas_extra: 40_000 },
        { documento: 1002, salario: 1_450_000.5, dias_trabajados: 20 },
      ],
      'ERP_API',
    );
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledTimes(2);
    expect((prisma.payrollEntry.upsert.mock.calls[0][0] as { update: Record<string, number> }).update).toMatchObject({ baseSalary: 1_500_000, workedDays: 20, overtimeHours: 3.5, overtimeAmount: 40_000 });
    expect((prisma.payrollEntry.upsert.mock.calls[1][0] as { update: Record<string, number> }).update.baseSalary).toBe(1_450_001);
    expect(finalStatus()).toBe('PROCESSED');
  });

  it('turns a row that throws into an ERROR issue and keeps processing the rest', async () => {
    const { prisma, service, issuesOf, finalStatus } = setup();
    prisma.payrollEntry.upsert.mockRejectedValueOnce(new Error('boom'));
    const up = await ingest(service, [
      { documento: '1001', salario: '1500000' },
      { documento: '1002', salario: '1500000' },
    ]);
    expect(up).toBeTruthy();
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledTimes(2);
    expect(issuesOf().find((i) => i.field === 'fila')).toMatchObject({ row: 2, severity: 'ERROR' });
    expect(finalStatus()).toBe('WITH_ISSUES');
    expect((prisma.payrollUpload.update.mock.calls.at(-1)![0] as { data: { okRows: number } }).data.okRows).toBe(1);
  });

  it('never leaves the upload in PROCESSING when the whole run blows up', async () => {
    const { prisma, service, finalStatus } = setup();
    prisma.worker.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(ingest(service, [{ documento: '1001', salario: '1500000' }])).rejects.toThrow('db down');
    expect(finalStatus()).toBe('FAILED');
    expect(prisma.payrollIssue.create).toHaveBeenCalled();
  });

  it('reports a duplicated document in the file', async () => {
    const { prisma, service, issuesOf } = setup();
    await ingest(service, [
      { documento: '1001', salario: '1500000' },
      { documento: '1.001', salario: '1500000' },
    ]);
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledTimes(1);
    expect(issuesOf().find((i) => i.message === 'Documento duplicado en el archivo')).toMatchObject({ row: 3 });
  });
});
