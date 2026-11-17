import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsDto } from '../company/company.controller.js';
import { AdminController } from './admin.controller.js';

const flexa = { sub: 'admin1', role: 'FLEXA_ADMIN', name: 'Flexa', companyId: null, workerId: null } as const;
const stored = { id: 's1', companyId: 'c1', maxAdvancePct: 50, recommendedPct: 25, minAmount: 20_000, maxAmountPerRequest: 1_000_000 };

// Mimics what the ValidationPipe produces with ES2023 class fields: omitted keys are own `undefined` properties.
const dtoOf = (over: Partial<SettingsDto>) => Object.assign(new SettingsDto(), { maxAdvancePct: undefined, recommendedPct: undefined, minAmount: undefined, maxAmountPerRequest: undefined }, over);

function setup() {
  const tx = {
    worker: { updateMany: vi.fn(async () => ({ count: 1 })), findUniqueOrThrow: vi.fn(async () => ({ id: 'w1', companyId: 'c1', kycStatus: 'APPROVED' })) },
    kycCheck: { create: vi.fn() },
  };
  const prisma = {
    company: { findUnique: vi.fn(async () => ({ id: 'c1' })) },
    companySettings: { upsert: vi.fn(async () => stored), update: vi.fn(async ({ data }) => ({ ...stored, ...data })) },
    worker: { findUnique: vi.fn(async () => ({ id: 'w1', companyId: 'c1', kycStatus: 'MANUAL_REVIEW' })) },
    incident: { findMany: vi.fn(async () => []) },
    advance: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { log: vi.fn() };
  const onboarding = { refresh: vi.fn() };
  const controller = new AdminController(prisma as never, audit as never, {} as never, onboarding as never);
  return { controller, prisma, tx, audit, onboarding };
}

describe('AdminController.settings', () => {
  it('applies the same cross-field rules to a partial update', async () => {
    const { controller, prisma } = setup();
    await expect(controller.settings(flexa, 'c1', dtoOf({ maxAdvancePct: 10 }))).rejects.toThrow('El recomendado no puede superar el tope');
    await expect(controller.settings(flexa, 'c1', dtoOf({ maxAdvancePct: 500 }))).rejects.toThrow(BadRequestException);
    await expect(controller.settings(flexa, 'c1', dtoOf({ minAmount: 2_000_000 }))).rejects.toThrow('El mínimo no puede superar el máximo por solicitud');
    expect(prisma.companySettings.update).not.toHaveBeenCalled();
  });

  it('stores only the keys that were sent', async () => {
    const { controller, prisma, audit } = setup();
    await controller.settings(flexa, 'c1', dtoOf({ feePerRequest: 300 }));
    expect(prisma.companySettings.update).toHaveBeenCalledWith({ where: { companyId: 'c1' }, data: { feePerRequest: 300 } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ data: { feePerRequest: 300 } }));
  });

  it('rejects an empty update and an unknown company', async () => {
    const { controller, prisma } = setup();
    await expect(controller.settings(flexa, 'c1', dtoOf({}))).rejects.toThrow('Sin parámetros válidos');
    prisma.company.findUnique.mockResolvedValue(null as never);
    await expect(controller.settings(flexa, 'nope', dtoOf({ feePerRequest: 1 }))).rejects.toThrow(NotFoundException);
  });
});

describe('AdminController.kycDecision', () => {
  const dto = { status: 'APPROVED', note: 'documento verificado' } as const;

  it('writes status, KycCheck and audit in one transaction, then refreshes onboarding', async () => {
    const { controller, prisma, tx, audit, onboarding } = setup();
    await controller.kycDecision(flexa, 'w1', dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.worker.updateMany).toHaveBeenCalledWith({ where: { id: 'w1', kycStatus: 'MANUAL_REVIEW' }, data: { kycStatus: 'APPROVED' } });
    expect(tx.kycCheck.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'KYC_APPROVED' }), tx);
    expect(onboarding.refresh).toHaveBeenCalledWith('w1');
  });

  it('does not refresh nor audit when the KycCheck write fails', async () => {
    const { controller, tx, audit, onboarding } = setup();
    tx.kycCheck.create.mockRejectedValue(new Error('db down'));
    await expect(controller.kycDecision(flexa, 'w1', dto)).rejects.toThrow('db down');
    expect(audit.log).not.toHaveBeenCalled();
    expect(onboarding.refresh).not.toHaveBeenCalled();
  });

  it('a concurrent second decision fails instead of overwriting the first', async () => {
    const { controller, tx, onboarding } = setup();
    tx.worker.updateMany.mockResolvedValue({ count: 0 });
    await expect(controller.kycDecision(flexa, 'w1', dto)).rejects.toThrow(BadRequestException);
    expect(tx.kycCheck.create).not.toHaveBeenCalled();
    expect(onboarding.refresh).not.toHaveBeenCalled();
  });

  it('keeps the 404 and the not-in-review checks', async () => {
    const { controller, prisma } = setup();
    prisma.worker.findUnique.mockResolvedValue(null as never);
    await expect(controller.kycDecision(flexa, 'w1', dto)).rejects.toThrow(NotFoundException);
    prisma.worker.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', kycStatus: 'APPROVED' } as never);
    await expect(controller.kycDecision(flexa, 'w1', dto)).rejects.toThrow(BadRequestException);
  });
});

describe('AdminController query validation', () => {
  it('answers 400 for an unknown status', () => {
    const { controller } = setup();
    expect(() => controller.incidents('BOGUS')).toThrow(BadRequestException);
    expect(() => controller.advancesList('BOGUS')).toThrow(BadRequestException);
    expect(() => controller.incidents('OPEN')).not.toThrow();
  });
});
