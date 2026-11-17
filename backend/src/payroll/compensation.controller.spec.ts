import { BadRequestException } from '@nestjs/common';
import { CompensationController } from './compensation.controller.js';

const user = { sub: 'u1', role: 'COMPANY_ADMIN', name: 'Admin', companyId: 'c1', workerId: null } as never;
const line = (id: string, doc: string, toCompensate: number, compensatedAmount = 0) => ({
  id,
  periodId: 'p1',
  workerId: `w-${id}`,
  toCompensate,
  compensatedAmount,
  difference: toCompensate - compensatedAmount,
  status: 'PENDING',
  worker: { docNumber: doc, firstName: 'A', lastName: 'B', site: null },
});

function setup(lines: ReturnType<typeof line>[], periodStatus = 'CLOSED') {
  const prisma = {
    payrollPeriod: {
      findFirst: vi.fn(async (..._args: unknown[]) => ({ id: 'p1', companyId: 'c1', label: 'Nov 2026', status: periodStatus, budget: null })),
      update: vi.fn(async (..._args: unknown[]) => ({})),
    },
    compensationLine: {
      findMany: vi.fn(async (..._args: unknown[]) => lines),
      // Writes through to the in-memory lines so refresh() sees what applied() stored.
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(lines.find((l) => l.id === where.id)!, data)),
    },
    reconciliation: {
      upsert: vi.fn(async ({ update }: { update: Record<string, unknown> }) => ({ id: 'r1', ...update })),
      update: vi.fn(async (..._args: unknown[]) => ({})),
      findUnique: vi.fn(async (..._args: unknown[]) => null),
    },
    incident: { create: vi.fn(async (..._args: unknown[]) => ({})), updateMany: vi.fn(async (..._args: unknown[]) => ({})) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const audit = { log: vi.fn(async (..._args: unknown[]) => undefined) };
  return { prisma, controller: new CompensationController(prisma as never, audit as never) };
}

describe('CompensationController.applied', () => {
  it('reads amounts with parseAmount: "103000.00" is 103000, not 10300000', async () => {
    const { prisma, controller } = setup([line('a', '1001', 103_000)]);
    await controller.applied(user, 'p1', { items: [{ docNumber: '1001', amount: '103000.00' }] });
    expect(prisma.compensationLine.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ compensatedAmount: 103_000, difference: 0, status: 'APPLIED' }) }));
  });

  it('keeps the sign of a negative amount instead of stripping it', async () => {
    const { prisma, controller } = setup([line('a', '1001', 100_000)]);
    await controller.applied(user, 'p1', { items: [{ docNumber: '1001', amount: '-5.000' }] });
    expect(prisma.compensationLine.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ compensatedAmount: -5_000, difference: 105_000 }) }));
  });

  it('reads CSV cells and treats a blank amount as 0', async () => {
    const { prisma, controller } = setup([line('a', '1001', 100_000), line('b', '1002', 50_000)]);
    const file = { buffer: Buffer.from('documento,valor_descontado\n1001,"$ 100.000"\n1002,\n') };
    await controller.applied(user, 'p1', {}, file);
    const calls = prisma.compensationLine.update.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(calls).toContainEqual(expect.objectContaining({ compensatedAmount: 100_000, status: 'APPLIED' }));
    expect(calls).toContainEqual(expect.objectContaining({ compensatedAmount: 0, status: 'PENDING' }));
  });

  it('rejects an unreadable amount with 400 before touching any line', async () => {
    const { prisma, controller } = setup([line('a', '1001', 100_000), line('b', '1002', 50_000)]);
    const call = controller.applied(user, 'p1', {
      items: [
        { docNumber: '1001', amount: '100000' },
        { docNumber: '1002', amount: 'mucho' },
      ],
    });
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.compensationLine.update).not.toHaveBeenCalled();
    expect(prisma.compensationLine.findMany).not.toHaveBeenCalled();
  });

  it('opens an incident when opposite-sign differences net to 0', async () => {
    // a: 100k expected, 150k deducted (-50k); b: 100k expected, 50k deducted (+50k). Net 0, absolute 100k.
    const { prisma, controller } = setup([line('a', '1001', 100_000), line('b', '1002', 100_000)]);
    const res = await controller.applied(user, 'p1', {
      items: [
        { docNumber: '1001', amount: 150_000 },
        { docNumber: '1002', amount: 50_000 },
      ],
    });
    expect(res.reconciliation.differenceTotal).toBe(0);
    expect(res.reconciliation.absoluteDifference).toBe(100_000);
    expect(prisma.incident.create).toHaveBeenCalledTimes(1);
  });
});

describe('CompensationController.reconcile', () => {
  const crossing = () => {
    // The stored lines already carry the offsetting differences the company reported.
    return setup([line('a', '1001', 100_000, 150_000), line('b', '1002', 100_000, 50_000)], 'COMPENSATED');
  };

  it('does not let differences of opposite sign cancel out', async () => {
    const { prisma, controller } = crossing();
    await expect(controller.reconcile(user, 'p1', {})).rejects.toThrow(/Quedan diferencias por \$100\.000/);
    expect(prisma.reconciliation.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ differenceTotal: 0, status: 'WITH_DIFFERENCES' }) }));
    expect(prisma.payrollPeriod.update).not.toHaveBeenCalled();
  });

  it('still allows a forced close, with a note', async () => {
    const { prisma, controller } = crossing();
    await expect(controller.reconcile(user, 'p1', { force: true })).rejects.toThrow('Explica por qué cierras con diferencias');
    await controller.reconcile(user, 'p1', { force: true, note: 'Ajuste acordado con la empresa' });
    expect(prisma.payrollPeriod.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'RECONCILED' } }));
  });

  it('reconciles when every line matches', async () => {
    const { prisma, controller } = setup([line('a', '1001', 100_000, 100_000), line('b', '1002', 50_000, 50_000)], 'COMPENSATED');
    await controller.reconcile(user, 'p1', {});
    expect(prisma.reconciliation.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'IN_PROGRESS' }) }));
    expect(prisma.payrollPeriod.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'RECONCILED' } }));
  });
});
