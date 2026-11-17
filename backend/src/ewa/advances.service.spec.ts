import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdvancesService } from './advances.service.js';

type Row = { id: string; status: string; [k: string]: unknown };

// In-memory stand-in for the Prisma calls AdvancesService makes. updateMany checks and sets the
// status in one synchronous step, like a status-guarded UPDATE in Postgres.
function setup(initial: Partial<Row> = {}, opts: { available?: number; periodStatus?: string; snapPeriodId?: string | null; blockers?: string[] } = {}) {
  const row: Row = {
    id: 'a1',
    code: 'FX-1',
    workerId: 'w1',
    periodId: 'p1',
    amount: 100_000,
    fee: 3_000,
    netAmount: 100_000,
    status: 'FAILED',
    bankAccount: { bank: 'Bancolombia', number: '1234' },
    worker: { companyId: 'c1' },
    ...initial,
  };
  const events: { status: string; note?: string }[] = [];
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    advance: {
      findUnique: vi.fn(async () => ({ ...row })),
      findFirst: vi.fn(async () => ({ ...row })),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string | { in: string[] } }; data: Partial<Row> }) => {
        const ok = typeof where.status === 'string' ? row.status === where.status : where.status.in.includes(row.status);
        if (!ok) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    advanceEvent: { create: vi.fn(async ({ data }: { data: { status: string; note?: string } }) => events.push(data)) },
    $queryRaw: vi.fn(async () => [{ status: opts.periodStatus ?? 'OPEN' }]),
    incident: { create: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    alert: { create: vi.fn(async () => ({})) },
    document: { create: vi.fn(async () => ({})) },
  };
  // Rolls the row and events back when the callback throws, like a real interactive transaction.
  // Transactions run one at a time, as the per-worker advisory lock / row lock would force.
  let queue: Promise<unknown> = Promise.resolve();
  const runTx = async (fn: (t: typeof tx) => Promise<unknown>) => {
    const saved = { ...row };
    const savedEvents = events.length;
    try {
      return await fn(tx);
    } catch (e) {
      for (const k of Object.keys(row)) delete row[k];
      Object.assign(row, saved);
      events.length = savedEvents;
      throw e;
    }
  };
  const $transaction = vi.fn((fn: (t: typeof tx) => Promise<unknown>) => {
    const run = queue.then(() => runTx(fn));
    queue = run.catch(() => undefined);
    return run;
  });
  const prisma = { ...tx, $transaction };
  const earnings = {
    snapshot: vi.fn(async () => ({
      period: opts.snapPeriodId === null ? null : { id: opts.snapPeriodId ?? 'p1' },
      available: opts.available ?? 500_000,
      blockerDetails: (opts.blockers ?? []).map((code) => ({ code, message: `bloqueo ${code}` })),
    })),
  };
  const audit = { log: vi.fn(async () => undefined) };
  const payments = { transfer: vi.fn(() => ({ ok: true as const, ref: 'PAY-1' })) };
  const funding = { reserve: vi.fn(() => ({ ok: true, ref: 'FND-1' })), release: vi.fn(() => ({ ok: true })) };
  const service = new AdvancesService(prisma as never, earnings as never, audit as never, payments as never, funding as never);
  return { row, events, tx, prisma, payments, funding, service };
}

describe('AdvancesService guarded transitions', () => {
  it('throws 409 and writes nothing when the guarded update matches no row', async () => {
    const { tx, events, payments, service } = setup({ status: 'APPROVED' });
    tx.advance.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.disburse('a1')).rejects.toBeInstanceOf(ConflictException);
    expect(events).toEqual([]);
    expect(payments.transfer).not.toHaveBeenCalled();
  });

  it('two concurrent retries trigger exactly one transfer', async () => {
    const { row, payments, service } = setup();
    const results = await Promise.allSettled([service.retry(null, 'a1', 'u1'), service.retry(null, 'a1', 'u2')]);
    expect(payments.transfer).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(row.status).toBe('DISBURSED');
  });

  it('two concurrent exception approvals trigger exactly one transfer', async () => {
    const { payments, service } = setup({ status: 'EXCEPTION' });
    await Promise.allSettled([
      service.resolveException('c1', 'a1', 'u1', true, 'ok'),
      service.resolveException('c1', 'a1', 'u2', true, 'ok'),
    ]);
    expect(payments.transfer).toHaveBeenCalledTimes(1);
  });

  it('cancel only moves REQUESTED/EXCEPTION advances', async () => {
    const { row, tx, service } = setup({ status: 'EXCEPTION' });
    // Simulates the company approving between the read and the write.
    tx.advance.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.cancel('w1', 'a1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(row.status).toBe('EXCEPTION');
  });
});

describe('AdvancesService.retry revalidation', () => {
  it('rejects when amount + fee no longer fits in the available', async () => {
    const { row, payments, service } = setup({}, { available: 102_000 });
    await expect(service.retry(null, 'a1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(row.status).toBe('FAILED');
    expect(payments.transfer).not.toHaveBeenCalled();
  });

  it('accepts when amount + fee is exactly the available', async () => {
    const { row, service } = setup({}, { available: 103_000 });
    await service.retry(null, 'a1', 'u1');
    expect(row.status).toBe('DISBURSED');
  });

  it('rejects when the period is no longer open', async () => {
    const { row, service } = setup({}, { periodStatus: 'CLOSED', snapPeriodId: null });
    await expect(service.retry(null, 'a1', 'u1')).rejects.toThrow('El periodo de nómina de esta solicitud ya no está abierto');
    expect(row.status).toBe('FAILED');
  });

  it('rejects when the current open period is a different one', async () => {
    const { service } = setup({}, { snapPeriodId: 'p2' });
    await expect(service.retry(null, 'a1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['COMPANY_SUSPENDED', 'WORKER_DISABLED', 'KYC', 'ACCOUNT', 'NO_PERIOD'])('rejects when the snapshot has the %s blocker', async (code) => {
    const { row, payments, service } = setup({}, { blockers: [code] });
    await expect(service.retry(null, 'a1', 'u1')).rejects.toThrow(`No se puede reintentar: bloqueo ${code}`);
    expect(row.status).toBe('FAILED');
    expect(payments.transfer).not.toHaveBeenCalled();
  });

  it('ignores blockers that applied only when the advance was first requested', async () => {
    const { row, service } = setup({}, { blockers: ['BLACKOUT', 'REQUEST_LIMIT', 'CONSENTS'] });
    await service.retry(null, 'a1', 'u1');
    expect(row.status).toBe('DISBURSED');
  });

  it('takes the per-worker advisory lock and a shared lock on the period row', async () => {
    const { tx, service } = setup();
    await service.retry(null, 'a1', 'u1');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect((tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray])[0].join('?')).toMatch(/FOR SHARE/);
  });
});

describe('AdvancesService.disburse failure recovery', () => {
  it('marks FAILED and releases the reservation when the transfer throws', async () => {
    const { row, events, payments, funding, service } = setup({ status: 'APPROVED' });
    payments.transfer.mockImplementationOnce(() => {
      throw new Error('timeout');
    });
    await service.disburse('a1');
    expect(row.status).toBe('FAILED');
    expect(events.at(-1)?.status).toBe('FAILED');
    expect(funding.release).toHaveBeenCalledWith('FND-1');
  });

  it('releases the reservation when the bank rejects the transfer', async () => {
    const { row, payments, funding, service } = setup({ status: 'APPROVED' });
    payments.transfer.mockReturnValueOnce({ ok: false, error: 'rechazada' } as never);
    await service.disburse('a1');
    expect(row.status).toBe('FAILED');
    expect(funding.release).toHaveBeenCalledWith('FND-1');
  });

  it('records DISBURSED (not FAILED, no release) when the transfer went out but the final write throws', async () => {
    const { row, tx, funding, service } = setup({ status: 'APPROVED' });
    tx.alert.create.mockRejectedValueOnce(new Error('db down'));
    await service.disburse('a1');
    expect(row.status).toBe('DISBURSED');
    expect(row.providerRef).toBe('PAY-1');
    expect(funding.release).not.toHaveBeenCalled();
  });

  it('request() returns the advance (FAILED) instead of a raw error when disburse throws', async () => {
    const { row, prisma, service } = setup({ status: 'APPROVED' });
    const earnings = (service as unknown as { earnings: Record<string, unknown> }).earnings;
    earnings.snapshot = vi.fn(async () => ({
      period: { id: 'p1' },
      available: 500_000,
      recommended: 200_000,
      used: 0,
      limit: 500_000,
      requestsCount: 0,
      nextPayAfterUsage: 1_000_000,
      settings: { exceptionAmount: 800_000, alarmUsagePct: 70, alarmRequestsCount: 3 },
      worker: { id: 'w1', companyId: 'c1', accounts: [{ id: 'b1', isDefault: true }] },
    }));
    earnings.simulate = vi.fn(() => ({ valid: true, errors: [], fee: 3_000, overRecommended: false, requiresAcknowledgement: false }));
    Object.assign(prisma.advance, { create: vi.fn(async () => ({ ...row })) });
    Object.assign(prisma, { alert: { ...prisma.alert, createMany: vi.fn(async () => ({})) } });
    vi.spyOn(service, 'disburse').mockRejectedValueOnce(new Error('boom'));
    const out = await service.request('w1', 'u1', { amount: 100_000 });
    expect(out).toMatchObject({ id: 'a1', status: 'FAILED' });
  });

  it('retry() never leaves the advance APPROVED when disburse throws', async () => {
    const { row, events, service } = setup();
    vi.spyOn(service, 'disburse').mockRejectedValueOnce(new Error('boom'));
    const out = await service.retry(null, 'a1', 'u1');
    expect(out).toMatchObject({ id: 'a1', status: 'FAILED' });
    expect(row.status).toBe('FAILED');
    expect(events.at(-1)).toMatchObject({ status: 'FAILED', note: 'No se pudo iniciar el desembolso' });
  });

  it('resolveException(approve) never leaves the advance APPROVED when disburse throws', async () => {
    const { row, service } = setup({ status: 'EXCEPTION' });
    vi.spyOn(service, 'disburse').mockRejectedValueOnce(new Error('boom'));
    const out = await service.resolveException('c1', 'a1', 'u1', true, 'ok');
    expect(out).toMatchObject({ id: 'a1', status: 'FAILED' });
    expect(row.status).toBe('FAILED');
  });

  it('marks FAILED when the final write throws after a rejected transfer', async () => {
    const { row, tx, payments, service } = setup({ status: 'APPROVED' });
    payments.transfer.mockReturnValueOnce({ ok: false, error: 'rechazada' } as never);
    tx.incident.create.mockRejectedValueOnce(new Error('db down'));
    await service.disburse('a1');
    expect(row.status).toBe('FAILED');
  });
});
