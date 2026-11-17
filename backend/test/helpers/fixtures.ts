import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { AdvanceStatus, KycStatus } from '../../src/generated/prisma/enums.js';

export const PASSWORD = 'Flexa2026!';
// Low cost on purpose: bcrypt.compare reads the cost from the hash, and fixtures create many users.
const HASH = bcrypt.hashSync(PASSWORD, 4);

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${randomBytes(2).toString('hex')}`;

// 10-digit cédula, unique per call in practice and never ending in 000 or 999 (those drive the KYC sandbox).
export function randomDoc() {
  for (;;) {
    const d = String(randomInt(1_000_000_000, 2_000_000_000));
    if (!d.endsWith('000') && !d.endsWith('999')) return d;
  }
}
// '1144555999' -> '1.144.555.999'
export const dotted = (doc: string) => doc.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// Destination accounts: the PaymentsProvider sandbox rejects numbers ending in 0000.
export const okAccount = () => `${randomInt(100_000_000, 999_999_999)}7`;
export const badAccount = () => `${randomInt(100_000_000, 999_999_999)}0000`;

export const DEFAULT_SETTINGS = {
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

// Local midnight `offset` days from today (the earnings maths works in local days).
const day = (offset: number) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset);
};

type PeriodShape = { start: number; end: number; pay: number };
// 30-day period, halfway through, paid at the end: well clear of any blackout.
const MID_PERIOD: PeriodShape = { start: -14, end: 15, pay: 15 };
// Pay day is tomorrow: inside the default 2-day blackout.
export const BLACKOUT_PERIOD: PeriodShape = { start: -28, end: 1, pay: 1 };

export type CompanyFx = Awaited<ReturnType<typeof createCompany>>;

// A fresh client company with an admin, a finance user, settings and an OPEN period built around today.
export async function createCompany(prisma: PrismaService, opts: { settings?: Partial<typeof DEFAULT_SETTINGS>; period?: PeriodShape } = {}) {
  const id = uid();
  const company = await prisma.company.create({
    data: {
      name: `Test Co ${id}`,
      nit: `T-${id}`,
      apiKey: `flx_test_${id}`,
      integrationType: 'ERP_API',
      erpName: 'TEST',
      settings: { create: { ...DEFAULT_SETTINGS, ...opts.settings } },
    },
  });
  const admin = await prisma.user.create({ data: { email: `rrhh.${id}@example.com`, name: 'Admin Test', role: 'COMPANY_ADMIN', passwordHash: HASH, companyId: company.id } });
  const finance = await prisma.user.create({ data: { email: `fin.${id}@example.com`, name: 'Finance Test', role: 'COMPANY_FINANCE', passwordHash: HASH, companyId: company.id } });
  const p = opts.period ?? MID_PERIOD;
  const period = await prisma.payrollPeriod.create({
    data: { companyId: company.id, label: `P-${id}`, startDate: day(p.start), endDate: day(p.end), payDate: day(p.pay), status: 'OPEN' },
  });
  return { id, company, admin, finance, period };
}

export type WorkerOpts = {
  docNumber?: string;
  email?: string;
  salary?: number;
  enabled?: boolean;
  // Has a user account (false = loaded by the company, not registered yet).
  registered?: boolean;
  // KYC approved, consents accepted and a destination account (defaults to `registered`).
  onboarded?: boolean;
  kycStatus?: KycStatus;
  account?: string;
};

// 3.000.000 of salary over a 30-day period at day 15 gives a bit under 700.000 available with the default rules.
export async function createWorker(prisma: PrismaService, companyId: string, o: WorkerOpts = {}) {
  const id = uid();
  const registered = o.registered ?? true;
  const onboarded = o.onboarded ?? registered;
  const enabled = o.enabled ?? true;
  const email = o.email ?? `worker.${id}@example.com`;
  const user = registered
    ? await prisma.user.create({ data: { email: email.toLowerCase(), name: `Test Worker ${id}`, role: 'WORKER', passwordHash: HASH, companyId } })
    : null;
  const worker = await prisma.worker.create({
    data: {
      companyId,
      userId: user?.id,
      docNumber: o.docNumber ?? randomDoc(),
      firstName: 'Test',
      lastName: `Worker ${id}`,
      email,
      baseSalary: o.salary ?? 3_000_000,
      enabled,
      status: !enabled ? 'DISABLED' : !registered ? 'INVITED' : onboarded ? 'ACTIVE' : 'PENDING_KYC',
      kycStatus: o.kycStatus ?? (onboarded ? 'APPROVED' : 'NOT_STARTED'),
    },
  });
  let account = null;
  if (onboarded) {
    const docs = await prisma.legalDocument.findMany({ where: { active: true } });
    if (!docs.length) throw new Error('flexa_test has no legal documents: the global setup seed did not run');
    await prisma.consent.createMany({ data: docs.map((d) => ({ workerId: worker.id, documentId: d.id })) });
    account = await addAccount(prisma, worker.id, o.account ?? okAccount(), true);
  }
  return { worker, user, account };
}

export function addAccount(prisma: PrismaService, workerId: string, number: string, isDefault = false) {
  return prisma.bankAccount.create({ data: { workerId, bank: 'Bancolombia', type: 'SAVINGS', number, holder: 'Test Holder', isDefault, verified: true } });
}

export function createFlexaAdmin(prisma: PrismaService) {
  return prisma.user.create({ data: { email: `flexa.${uid()}@example.com`, name: 'FLEXA Test', role: 'FLEXA_ADMIN', passwordHash: HASH } });
}

// Direct insert, for cases that only need an advance to exist (no events, no disbursement).
export function insertAdvance(
  prisma: PrismaService,
  o: { workerId: string; periodId: string; bankAccountId: string; amount?: number; status?: AdvanceStatus },
) {
  const amount = o.amount ?? 50_000;
  return prisma.advance.create({
    data: { code: `FX-T${uid()}`, workerId: o.workerId, periodId: o.periodId, bankAccountId: o.bankAccountId, amount, netAmount: amount, status: o.status ?? 'DISBURSED', availableAtRequest: amount, recommendedAtRequest: amount },
  });
}

// Floors to a multiple of `step`, like the earnings maths does with the available.
export const floorTo = (n: number, step = 1000) => Math.floor(n / step) * step;
