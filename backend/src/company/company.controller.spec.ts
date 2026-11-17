import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdvanceStatus } from '../generated/prisma/enums.js';
import { CompanyController, SettingsDto, checkSettingsUpdate, enumParam, maskAccount, maskDetail, normalizeWorkerDoc } from './company.controller.js';

const stored = { maxAdvancePct: 50, recommendedPct: 25, minAmount: 20_000, maxAmountPerRequest: 1_000_000 };

// Mimics what the ValidationPipe produces with ES2023 class fields: omitted keys are own `undefined` properties.
const dtoOf = (over: Partial<SettingsDto>) => Object.assign(new SettingsDto(), { maxAdvancePct: undefined, recommendedPct: undefined, minAmount: undefined, maxAmountPerRequest: undefined }, over);

describe('checkSettingsUpdate', () => {
  it('returns only the keys that were sent', () => {
    expect(checkSettingsUpdate(stored, dtoOf({ feePerRequest: 500 }))).toEqual({ feePerRequest: 500 });
  });

  it('drops null as well as undefined', () => {
    expect(checkSettingsUpdate(stored, dtoOf({ minAmount: null as never, feePerRequest: 0 }))).toEqual({ feePerRequest: 0 });
  });

  it('checks a partial update against the stored values', () => {
    // Only maxAdvancePct sent: the stored recommendedPct (25) still has to fit.
    expect(() => checkSettingsUpdate(stored, dtoOf({ maxAdvancePct: 10 }))).toThrow('El recomendado no puede superar el tope');
    // Only minAmount sent: it must not exceed the stored maxAmountPerRequest.
    expect(() => checkSettingsUpdate(stored, dtoOf({ minAmount: 2_000_000 }))).toThrow('El mínimo no puede superar el máximo por solicitud');
  });

  it('accepts a coherent partial update', () => {
    expect(checkSettingsUpdate(stored, dtoOf({ maxAdvancePct: 60, recommendedPct: 30 }))).toEqual({ maxAdvancePct: 60, recommendedPct: 30 });
  });

  it('enforces maxAdvancePct within 0..100', () => {
    expect(() => checkSettingsUpdate(stored, dtoOf({ maxAdvancePct: 500 }))).toThrow(BadRequestException);
    expect(() => checkSettingsUpdate(stored, dtoOf({ maxAdvancePct: -1 }))).toThrow(BadRequestException);
    expect(checkSettingsUpdate(stored, dtoOf({ maxAdvancePct: 100 }))).toEqual({ maxAdvancePct: 100 });
  });
});

describe('maskAccount', () => {
  it('keeps only the last 4 digits', () => {
    expect(maskAccount('0012345678901234')).toBe('****1234');
  });
  it('never reveals a short number', () => {
    expect(maskAccount('1234')).toBe('****');
    expect(maskAccount('')).toBe('****');
  });
});

describe('normalizeWorkerDoc', () => {
  it('stores cédulas digits-only', () => {
    expect(normalizeWorkerDoc('1.144.555.999')).toBe('1144555999');
    expect(normalizeWorkerDoc(' 1144 555-999 ', 'CC')).toBe('1144555999');
    expect(normalizeWorkerDoc('1.144.555.999', 'cc')).toBe('1144555999');
  });
  it('strips separators from any numeric document', () => {
    expect(normalizeWorkerDoc('12.345.678', 'CE')).toBe('12345678');
  });
  it('keeps alphanumeric non-cédula documents untouched', () => {
    expect(normalizeWorkerDoc(' AB123456 ', 'PA')).toBe('AB123456');
  });
  it('yields an empty string when a cédula has no digits', () => {
    expect(normalizeWorkerDoc('abc', 'CC')).toBe('');
  });
});

describe('enumParam', () => {
  it('passes valid values and empty input', () => {
    expect(enumParam(AdvanceStatus, 'DISBURSED')).toBe('DISBURSED');
    expect(enumParam(AdvanceStatus, undefined)).toBeUndefined();
    expect(enumParam(AdvanceStatus, '')).toBeUndefined();
  });
  it('rejects unknown values with 400', () => {
    expect(() => enumParam(AdvanceStatus, 'NOPE')).toThrow(BadRequestException);
    expect(() => enumParam(AdvanceStatus, 'disbursed')).toThrow(BadRequestException);
    expect(() => enumParam(AdvanceStatus, ['DISBURSED', 'FAILED'] as never)).toThrow(BadRequestException);
  });
});

// ---------- Controller behaviour with a fake Prisma ----------

const admin = { sub: 'u1', role: 'COMPANY_ADMIN', name: 'Ana', companyId: 'c1', workerId: null } as const;

function setup() {
  const prisma = {
    worker: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(async ({ data }) => ({ id: 'w-new', ...data })), update: vi.fn(), findMany: vi.fn(async () => []) },
    advance: { findFirst: vi.fn(), findMany: vi.fn(async () => []) },
    incident: { create: vi.fn(async ({ data }) => ({ id: 'i1', ...data })), findMany: vi.fn(async () => []) },
    user: { updateMany: vi.fn(async () => ({ count: 1 })) },
    site: { findMany: vi.fn(async () => []), findFirst: vi.fn() },
    auditLog: { findMany: vi.fn(async () => []) },
    companySettings: { update: vi.fn(async ({ data }) => ({ id: 's1', ...stored, ...data })) },
  };
  const audit = { log: vi.fn() };
  const earnings = { settings: vi.fn(async () => ({ id: 's1', ...stored })), currentPeriod: vi.fn(async () => null) };
  const advances = { detail: vi.fn() };
  const controller = new CompanyController(prisma as never, audit as never, earnings as never, advances as never);
  return { controller, prisma, audit, earnings, advances };
}

describe('CompanyController.createIncident', () => {
  const dto = { category: 'OTHER', title: 't', description: 'd' };

  it('rejects a workerId from another company', async () => {
    const { controller, prisma } = setup();
    prisma.worker.findFirst.mockResolvedValue(null);
    await expect(controller.createIncident(admin, { ...dto, workerId: 'w-other' })).rejects.toThrow(NotFoundException);
    expect(prisma.worker.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w-other', companyId: 'c1' } }));
    expect(prisma.incident.create).not.toHaveBeenCalled();
  });

  it('rejects an advanceId whose worker belongs to another company', async () => {
    const { controller, prisma } = setup();
    prisma.advance.findFirst.mockResolvedValue(null);
    await expect(controller.createIncident(admin, { ...dto, advanceId: 'a-other' })).rejects.toThrow(NotFoundException);
    expect(prisma.advance.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a-other', worker: { companyId: 'c1' } } }));
    expect(prisma.incident.create).not.toHaveBeenCalled();
  });

  it('creates the incident when both references belong to the company', async () => {
    const { controller, prisma } = setup();
    prisma.worker.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.advance.findFirst.mockResolvedValue({ id: 'a1' });
    await controller.createIncident(admin, { ...dto, workerId: 'w1', advanceId: 'a1' });
    expect(prisma.incident.create).toHaveBeenCalledWith({ data: { ...dto, workerId: 'w1', advanceId: 'a1', companyId: 'c1' } });
  });

  it('skips the lookups when no reference is given', async () => {
    const { controller, prisma } = setup();
    await controller.createIncident(admin, dto);
    expect(prisma.worker.findFirst).not.toHaveBeenCalled();
    expect(prisma.advance.findFirst).not.toHaveBeenCalled();
  });
});

describe('CompanyController.advance', () => {
  it('masks the destination account number', async () => {
    const { controller, prisma, advances } = setup();
    advances.detail.mockResolvedValue({ id: 'a1', workerId: 'w1', bankAccount: { bank: 'Bancolombia', type: 'SAVINGS', number: '0012345678901234' } });
    prisma.worker.findFirst.mockResolvedValue({ id: 'w1' });
    const res = await controller.advance(admin, 'a1');
    expect(res.bankAccount).toEqual({ bank: 'Bancolombia', type: 'SAVINGS', number: '****1234' });
    expect(JSON.stringify(res)).not.toContain('0012345678901234');
  });

  it('answers 404 for an advance of another company', async () => {
    const { controller, prisma, advances } = setup();
    advances.detail.mockResolvedValue({ id: 'a1', workerId: 'w9', bankAccount: { number: '0012345678901234' } });
    prisma.worker.findFirst.mockResolvedValue(null);
    await expect(controller.advance(admin, 'a1')).rejects.toThrow(NotFoundException);
  });
});

describe('CompanyController.updateSettings', () => {
  it('validates a partial update against the stored values and stores only what was sent', async () => {
    const { controller, prisma } = setup();
    await expect(controller.updateSettings(admin, dtoOf({ maxAdvancePct: 10 }))).rejects.toThrow(BadRequestException);
    expect(prisma.companySettings.update).not.toHaveBeenCalled();

    await controller.updateSettings(admin, dtoOf({ feePerRequest: 300 }));
    expect(prisma.companySettings.update).toHaveBeenCalledWith({ where: { companyId: 'c1' }, data: { feePerRequest: 300 } });
  });
});

describe('CompanyController.toggleTeam', () => {
  it('does not let an admin deactivate themselves', async () => {
    const { controller, prisma } = setup();
    await expect(controller.toggleTeam(admin, 'u1', { active: false })).rejects.toThrow(BadRequestException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('only touches staff accounts of the same company', async () => {
    const { controller, prisma } = setup();
    await controller.toggleTeam(admin, 'u2', { active: false });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u2', companyId: 'c1', role: { in: ['COMPANY_ADMIN', 'COMPANY_FINANCE'] } }, data: { active: false } });
  });

  it('answers 404 when no staff user matches', async () => {
    const { controller, prisma } = setup();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(controller.toggleTeam(admin, 'u-worker', { active: false })).rejects.toThrow(NotFoundException);
  });
});

describe('CompanyController.uploadWorkers', () => {
  const file = (text: string | Buffer, originalname = 'workers.csv') => ({ buffer: Buffer.isBuffer(text) ? text : Buffer.from(text), originalname });
  const header = 'documento,nombres,apellidos,correo,salario\n';

  it('rejects files that are not CSV', async () => {
    const { controller } = setup();
    await expect(controller.uploadWorkers(admin, file(header, 'workers.xlsx'))).rejects.toThrow('El archivo debe ser un CSV');
    await expect(controller.uploadWorkers(admin, file(Buffer.from([0x50, 0x4b, 0x00, 0x04])))).rejects.toThrow('El archivo debe ser un CSV');
  });

  it('caps the number of rows', async () => {
    const { controller } = setup();
    const rows = Array.from({ length: 5001 }, (_, i) => `${i + 1},Ana,Perez,a${i}@x.co,1500000`).join('\n');
    await expect(controller.uploadWorkers(admin, file(header + rows))).rejects.toThrow('máximo de 5000 filas');
  });

  it('stores cédulas digits-only and reports bad rows without aborting', async () => {
    const { controller, prisma } = setup();
    prisma.worker.findUnique.mockResolvedValue(null);
    const csv = header + '1.144.555.999,Ana,Perez,ana@x.co,"1.500.000"\nabc,Luis,Gomez,luis@x.co,1500000\n2.000.111,Eva,Rios,eva@x.co,1800000\n';
    const res = await controller.uploadWorkers(admin, file(csv));
    expect(res.created).toBe(2);
    expect(res.errors).toEqual([{ row: 3, message: 'Documento no válido' }]);
    expect(prisma.worker.findUnique).toHaveBeenCalledWith({ where: { companyId_docNumber: { companyId: 'c1', docNumber: '1144555999' } } });
    expect(prisma.worker.create.mock.calls.map(([a]) => a.data.docNumber)).toEqual(['1144555999', '2000111']);
  });
});

describe('CompanyController.createWorker', () => {
  it('normalises the cédula before looking up and storing', async () => {
    const { controller, prisma } = setup();
    prisma.worker.findUnique.mockResolvedValue(null);
    await controller.createWorker(admin, { docNumber: '1.144.555.999', firstName: 'Ana', lastName: 'Perez', email: 'ANA@x.co', baseSalary: 1_500_000 });
    expect(prisma.worker.create).toHaveBeenCalledWith({ data: expect.objectContaining({ docNumber: '1144555999', companyId: 'c1', email: 'ana@x.co' }) });
  });
});

describe('CompanyController query validation', () => {
  it('answers 400 for an unknown status or a bad date', async () => {
    const { controller } = setup();
    expect(() => controller.incidents(admin, 'BOGUS')).toThrow(BadRequestException);
    await expect(controller.listAdvances(admin, 'BOGUS')).rejects.toThrow(BadRequestException);
    await expect(controller.workers(admin, undefined, 'BOGUS')).rejects.toThrow(BadRequestException);
    await expect(controller.listAdvances(admin, undefined, undefined, undefined, 'not-a-date')).rejects.toThrow('Fecha inicial no válida');
  });
});

describe('maskDetail and the advance action endpoints', () => {
  const raw = { id: 'a1', status: 'DISBURSED', bankAccount: { bank: 'Bancolombia', type: 'SAVINGS', number: '0012345678901234' } };

  it('masks only when a bank account is present and tolerates null', () => {
    expect(maskDetail(raw).bankAccount.number).toBe('****1234');
    expect(maskDetail({ id: 'a1' })).toEqual({ id: 'a1' });
    expect(maskDetail(null)).toBeNull();
  });

  it('approve, reject and retry never return the full account number', async () => {
    const { controller, advances } = setup();
    Object.assign(advances, { resolveException: vi.fn(async () => raw), retry: vi.fn(async () => raw) });
    for (const res of [await controller.approve(admin, 'a1', { note: 'ok ok' }), await controller.reject(admin, 'a1', { note: 'no no' }), await controller.retry(admin, 'a1')]) {
      expect(JSON.stringify(res)).not.toContain('0012345678901234');
      expect(res?.bankAccount.number).toBe('****1234');
    }
  });
});
