import { EarningsService, paymentBlockers, type Snapshot } from './earnings.service.js';

const settings = {
  maxAdvancePct: 50,
  recommendedPct: 25,
  minAmount: 20_000,
  maxAmountPerRequest: 1_000_000,
  maxRequestsPerPeriod: 4,
  feePerRequest: 0,
  blackoutDaysBeforePay: 2,
  alarmUsagePct: 70,
  alarmRequestsCount: 3,
  exceptionAmount: 800_000,
};

const snap = (over: Partial<Snapshot> = {}) =>
  ({
    settings,
    period: { payDate: new Date('2026-11-30') },
    blockers: [],
    used: 0,
    limit: 460_000,
    available: 460_000,
    recommended: 230_000,
    requestsCount: 0,
    nextPayAfterUsage: 1_727_000,
    ...over,
  }) as unknown as Snapshot;

describe('EarningsService.simulate', () => {
  const service = new EarningsService(null as never);

  it('accepts an amount within the recommended without warnings', () => {
    const r = service.simulate(snap(), 100_000);
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.nextPayAfter).toBe(1_627_000);
  });

  it('warns but allows going over the recommended (it is a reference, not a limit)', () => {
    const r = service.simulate(snap(), 300_000);
    expect(r.valid).toBe(true);
    expect(r.overRecommended).toBe(true);
    expect(r.requiresAcknowledgement).toBe(true);
  });

  it('rejects amounts over the available', () => {
    const r = service.simulate(snap(), 500_000);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('El monto supera tu disponible');
  });

  it('rejects amounts under the minimum', () => {
    expect(service.simulate(snap(), 5_000).valid).toBe(false);
  });

  it('carries blockers such as missing KYC', () => {
    const r = service.simulate(snap({ blockers: ['Debes completar la validación de identidad'] }), 50_000);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/identidad/);
  });

  it('adds the fee to what is discounted from payroll', () => {
    const r = service.simulate(snap({ settings: { ...settings, feePerRequest: 3_000 } } as never), 100_000);
    expect(r.toDiscountFromPayroll).toBe(103_000);
    expect(r.youReceive).toBe(100_000);
  });
});

describe('EarningsService.simulate fee cap', () => {
  const service = new EarningsService(null as never);
  const withFee = (over: Partial<Snapshot> = {}) => snap({ settings: { ...settings, feePerRequest: 3_000 }, ...over } as never);

  it('rejects an amount equal to the available when the fee no longer fits', () => {
    const r = service.simulate(withFee({ available: 100_000 }), 100_000);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('El monto más la comisión supera tu disponible');
  });

  it('accepts an amount whose amount + fee is exactly the available', () => {
    expect(service.simulate(withFee({ available: 100_000 }), 97_000).valid).toBe(true);
  });

  it('keeps the plain message when the amount alone is over the available', () => {
    expect(service.simulate(withFee({ available: 100_000 }), 150_000).errors).toContain('El monto supera tu disponible');
  });
});

describe('EarningsService blockers / paymentBlockers', () => {
  const period = {
    id: 'p1',
    status: 'OPEN',
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-11-30'),
    payDate: new Date('2026-11-30'),
    createdAt: new Date('2026-11-01'),
  };
  const worker = {
    id: 'w1',
    companyId: 'c1',
    baseSalary: 1_500_000,
    enabled: true,
    status: 'ACTIVE',
    kycStatus: 'APPROVED',
    company: { status: 'ACTIVE' },
    consents: [{ document: { type: 'TERMS' } }, { document: { type: 'PAYROLL_DEDUCTION_AUTH' } }],
    accounts: [{ id: 'a1' }],
  };
  const tx = (advances: number, w = worker) =>
    ({
      worker: { findUnique: async () => w },
      companySettings: { findUnique: async () => settings },
      payrollPeriod: { findFirst: async () => period },
      payrollEntry: { findUnique: async () => null },
      payrollNovelty: { findMany: async () => [] },
      advance: { findMany: async () => Array.from({ length: advances }, () => ({ amount: 20_000, fee: 0 })) },
      servicePayment: { findMany: async () => [] },
    }) as never;
  const service = new EarningsService(null as never);

  it('drops only the request-count blocker for service payments; blackout still applies', async () => {
    // 2026-11-29 is one day before pay (blackout is 2 days) and 4 requests reach the cap.
    const s = await service.snapshot('w1', tx(4), new Date('2026-11-29T12:00:00'));
    expect(s.blockers).toHaveLength(2);
    expect(s.blockers.some((b) => b.startsWith('Alcanzaste el máximo'))).toBe(true);
    expect(paymentBlockers(s)).toEqual(['No se reciben solicitudes 2 días antes del pago de nómina']);
  });

  it('keeps KYC, consent and account blockers for service payments', async () => {
    const s = await service.snapshot(
      'w1',
      tx(4, { ...worker, kycStatus: 'PENDING', consents: [], accounts: [] }),
      new Date('2026-11-10T12:00:00'),
    );
    expect(paymentBlockers(s)).toEqual([
      'Debes completar la validación de identidad',
      'Debes aceptar los términos y la autorización de descuento por nómina',
      'Debes registrar una cuenta de destino',
    ]);
  });

  it('blocks payments when there is no open period', async () => {
    const s = await service.snapshot('w1', { ...(tx(0) as object), payrollPeriod: { findFirst: async () => null } } as never);
    expect(paymentBlockers(s)).toEqual(['La empresa no tiene un periodo de nómina abierto']);
  });
});
