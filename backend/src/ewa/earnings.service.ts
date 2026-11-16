import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Tx } from '../common/audit.service.js';
import { daysBetween, floorTo, sum } from '../common/util.js';
import type { CompanySettings, PayrollPeriod } from '../generated/prisma/client.js';

// Advances that still count against the available amount.
export const LIVE_ADVANCE = ['REQUESTED', 'EXCEPTION', 'APPROVED', 'DISBURSING', 'DISBURSED'] as const;

// Employee share of health (4 %) and pension (4 %) contributions in Colombia.
const LEGAL_DEDUCTION_RATE = 0.08;
// Novelties that reduce paid days.
const UNPAID_NOVELTIES = ['AUSENCIA', 'LICENCIA_NO_REMUNERADA', 'SUSPENSION'];

export type Snapshot = Awaited<ReturnType<EarningsService['snapshot']>>;

// Módulo 2: salary of the period, earned to date, available and recommended amounts.
@Injectable()
export class EarningsService {
  constructor(private prisma: PrismaService) {}

  async currentPeriod(companyId: string, tx: Tx = this.prisma, at = new Date()) {
    const period =
      (await tx.payrollPeriod.findFirst({
        where: { companyId, status: 'OPEN', startDate: { lte: at }, endDate: { gte: at } },
      })) ?? (await tx.payrollPeriod.findFirst({ where: { companyId, status: 'OPEN' }, orderBy: { startDate: 'desc' } }));
    return period;
  }

  async settings(companyId: string, tx: Tx = this.prisma) {
    return (
      (await tx.companySettings.findUnique({ where: { companyId } })) ??
      (await tx.companySettings.create({ data: { companyId } }))
    );
  }

  async snapshot(workerId: string, tx: Tx = this.prisma, at = new Date()) {
    const worker = await tx.worker.findUnique({
      where: { id: workerId },
      include: {
        company: true,
        consents: { include: { document: true } },
        accounts: { where: { active: true } },
      },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado');
    const settings = await this.settings(worker.companyId, tx);
    const period = await this.currentPeriod(worker.companyId, tx, at);

    if (!period) {
      return {
        worker,
        settings,
        period: null,
        blockers: ['La empresa no tiene un periodo de nómina abierto'],
        ...this.empty(worker.baseSalary),
      };
    }

    const [entry, novelties, advances, payments] = await Promise.all([
      tx.payrollEntry.findUnique({ where: { periodId_workerId: { periodId: period.id, workerId } } }),
      tx.payrollNovelty.findMany({ where: { periodId: period.id, workerId } }),
      tx.advance.findMany({ where: { periodId: period.id, workerId, status: { in: [...LIVE_ADVANCE] } } }),
      tx.servicePayment.findMany({ where: { periodId: period.id, workerId, status: 'COMPLETED' } }),
    ]);

    const baseSalary = entry?.baseSalary ?? worker.baseSalary;
    const periodDays = Math.max(1, daysBetween(period.startDate, period.endDate) + 1);
    // Commercial month: monthly salary / 30 per day, scaled to the period length.
    const periodSalary = Math.round((baseSalary / 30) * Math.min(periodDays, 30));
    const daily = periodSalary / periodDays;
    const elapsed = Math.min(periodDays, Math.max(0, daysBetween(period.startDate, at) + 1));
    const unpaidDays = sum(
      novelties.filter((n) => UNPAID_NOVELTIES.includes(n.type)),
      (n) => n.days,
    );
    // If payroll reported worked days, trust them; otherwise use calendar days elapsed.
    const workedDays = Math.max(0, (entry?.workedDays ? Math.min(entry.workedDays, elapsed) : elapsed) - unpaidDays);
    const fraction = workedDays / periodDays;

    const extras = (entry?.overtimeAmount ?? 0) + (entry?.surcharges ?? 0);
    const grossEarned = Math.round(daily * workedDays + extras);
    const legalDeductions = Math.round(grossEarned * LEGAL_DEDUCTION_RATE);
    const otherDeductions = Math.round((entry?.deductions ?? 0) * fraction);
    const netEarned = Math.max(0, grossEarned - legalDeductions - otherDeductions);

    const advancedAmount = sum(advances, (a) => a.amount);
    const feesAmount = sum(advances, (a) => a.fee);
    const paymentsAmount = sum(payments, (p) => p.amount);
    const used = advancedAmount + feesAmount + paymentsAmount;

    const limit = floorTo((netEarned * settings.maxAdvancePct) / 100);
    const available = floorTo(limit - used);
    const recommended = Math.min(available, floorTo((netEarned * settings.recommendedPct) / 100 - used));

    // Projected pay for the whole period, before and after what was already advanced.
    const projectedGross = periodSalary + extras;
    const projectedNet = Math.round(
      projectedGross - projectedGross * LEGAL_DEDUCTION_RATE - (entry?.deductions ?? 0),
    );
    const nextPayAfterUsage = projectedNet - used;

    const blockers = this.blockers({ worker, settings, period, at, requests: advances.length });

    return {
      worker,
      settings,
      period,
      blockers,
      baseSalary,
      periodSalary,
      periodDays,
      workedDays,
      unpaidDays,
      grossEarned,
      legalDeductions,
      otherDeductions,
      netEarned,
      extras,
      used,
      advancedAmount,
      feesAmount,
      paymentsAmount,
      requestsCount: advances.length,
      limit,
      available,
      recommended: Math.max(0, recommended),
      projectedNet,
      nextPayAfterUsage,
      usagePct: limit ? Math.round((used / limit) * 100) : 0,
      dataUpdatedAt: entry?.updatedAt ?? period.createdAt,
    };
  }

  private empty(baseSalary: number) {
    return {
      baseSalary,
      periodSalary: 0,
      periodDays: 0,
      workedDays: 0,
      unpaidDays: 0,
      grossEarned: 0,
      legalDeductions: 0,
      otherDeductions: 0,
      netEarned: 0,
      extras: 0,
      used: 0,
      advancedAmount: 0,
      feesAmount: 0,
      paymentsAmount: 0,
      requestsCount: 0,
      limit: 0,
      available: 0,
      recommended: 0,
      projectedNet: 0,
      nextPayAfterUsage: 0,
      usagePct: 0,
      dataUpdatedAt: null as Date | null,
    };
  }

  private blockers(input: {
    worker: { enabled: boolean; status: string; kycStatus: string; consents: { document: { type: string } }[]; accounts: unknown[]; company: { status: string } };
    settings: CompanySettings;
    period: PayrollPeriod;
    at: Date;
    requests: number;
  }) {
    const { worker, settings, period, at } = input;
    const out: string[] = [];
    if (worker.company.status !== 'ACTIVE') out.push('El servicio está suspendido para tu empresa');
    if (!worker.enabled || worker.status === 'DISABLED' || worker.status === 'RETIRED')
      out.push('Tu empresa no tiene habilitado FLEXA para ti');
    if (worker.kycStatus !== 'APPROVED') out.push('Debes completar la validación de identidad');
    const accepted = new Set(worker.consents.map((c) => c.document.type));
    if (!accepted.has('TERMS') || !accepted.has('PAYROLL_DEDUCTION_AUTH'))
      out.push('Debes aceptar los términos y la autorización de descuento por nómina');
    if (!worker.accounts.length) out.push('Debes registrar una cuenta de destino');
    if (daysBetween(at, period.payDate) < settings.blackoutDaysBeforePay)
      out.push(`No se reciben solicitudes ${settings.blackoutDaysBeforePay} días antes del pago de nómina`);
    if (input.requests >= settings.maxRequestsPerPeriod)
      out.push(`Alcanzaste el máximo de ${settings.maxRequestsPerPeriod} solicitudes en el periodo`);
    return out;
  }

  // Módulo 2: plain explanation of how the available amount is computed.
  explain(s: Snapshot) {
    const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
    if (!s.period) return { steps: [], note: 'No hay periodo de nómina abierto.' };
    return {
      steps: [
        { label: 'Salario del periodo', value: s.periodSalary, detail: `Salario base ${fmt(s.baseSalary)} para ${s.periodDays} días` },
        { label: 'Días trabajados a la fecha', value: s.workedDays, detail: s.unpaidDays ? `Se descuentan ${s.unpaidDays} días no remunerados` : 'Según nómina y calendario' },
        { label: 'Horas extra y recargos', value: s.extras, detail: 'Reportados por la empresa en la nómina' },
        { label: 'Devengado bruto', value: s.grossEarned, detail: 'Salario diario × días trabajados + extras' },
        { label: 'Salud y pensión (8 %)', value: -s.legalDeductions, detail: 'Aportes obligatorios del trabajador' },
        { label: 'Otros descuentos', value: -s.otherDeductions, detail: 'Proporcionales a los días trabajados' },
        { label: 'Devengado neto', value: s.netEarned, detail: 'Lo que ya ganaste y cobrarías hoy' },
        { label: `Tope (${s.settings.maxAdvancePct} % del neto)`, value: s.limit, detail: 'Regla definida por tu empresa' },
        { label: 'Ya utilizado en el periodo', value: -s.used, detail: 'Retiros, comisiones y pagos de servicios' },
        { label: 'Disponible', value: s.available, detail: 'Lo máximo que puedes solicitar ahora' },
      ],
      note: `El recomendado (${fmt(s.recommended)}) equivale al ${s.settings.recommendedPct} % de tu neto menos lo ya usado. Es una referencia, no un límite.`,
    };
  }

  // Módulos 3 y 4: simulate a request. Never creates anything.
  simulate(s: Snapshot, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Ingresa un monto válido');
    const { settings } = s;
    const errors: string[] = [...s.blockers];
    if (amount < settings.minAmount) errors.push(`El monto mínimo es $${settings.minAmount.toLocaleString('es-CO')}`);
    if (amount > settings.maxAmountPerRequest)
      errors.push(`El monto máximo por solicitud es $${settings.maxAmountPerRequest.toLocaleString('es-CO')}`);
    if (amount > s.available) errors.push('El monto supera tu disponible');

    const fee = settings.feePerRequest;
    const usedAfter = s.used + amount + fee;
    const usagePctAfter = s.limit ? Math.round((usedAfter / s.limit) * 100) : 100;
    const warnings: string[] = [];
    const overRecommended = amount > s.recommended;
    if (overRecommended)
      warnings.push('Este monto supera el recomendado. Tu siguiente pago será menor de lo que te sugerimos.');
    if (usagePctAfter >= settings.alarmUsagePct)
      warnings.push(`Con este retiro habrás usado el ${usagePctAfter} % de tu tope del periodo.`);
    if (s.requestsCount + 1 >= settings.alarmRequestsCount)
      warnings.push(`Este sería tu retiro número ${s.requestsCount + 1} en el periodo.`);
    if (amount >= settings.exceptionAmount)
      warnings.push('Por su valor, esta solicitud será revisada por tu empresa antes del desembolso.');

    return {
      amount,
      fee,
      youReceive: amount,
      toDiscountFromPayroll: amount + fee,
      available: s.available,
      recommended: s.recommended,
      overRecommended,
      nextPayBefore: s.nextPayAfterUsage,
      nextPayAfter: s.nextPayAfterUsage - amount - fee,
      payDate: s.period?.payDate ?? null,
      usagePctAfter,
      valid: errors.length === 0,
      errors,
      // Warnings only make sense for an amount that can actually be requested.
      warnings: errors.length ? [] : warnings,
      requiresAcknowledgement: errors.length === 0 && warnings.length > 0,
    };
  }
}
