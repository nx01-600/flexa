import { EarningsService, type Snapshot } from './earnings.service.js';

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
