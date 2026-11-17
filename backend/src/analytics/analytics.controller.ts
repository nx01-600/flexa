import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser, CurrentUser, Roles, requireCompany } from '../common/auth.js';
import { DAY, daysBetween, pct, sum, toCsv } from '../common/util.js';
import type { PayrollPeriod } from '../generated/prisma/client.js';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Módulo 9: turns payroll and operation data into indicators and reports. Descriptive only, no predictive models.
@Roles('COMPANY_ADMIN', 'COMPANY_FINANCE')
@Controller('analytics')
export class AnalyticsController {
  constructor(private prisma: PrismaService) {}

  private async resolvePeriod(companyId: string, periodId?: string) {
    const p = periodId
      ? await this.prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId } })
      : ((await this.prisma.payrollPeriod.findFirst({ where: { companyId, status: 'OPEN' }, orderBy: { startDate: 'desc' } })) ??
        (await this.prisma.payrollPeriod.findFirst({ where: { companyId }, orderBy: { startDate: 'desc' } })));
    if (!p) throw new NotFoundException('No hay periodos de nómina');
    return p;
  }

  // Payroll figures for one period: accumulated to date vs projected for the full period.
  private async payroll(period: PayrollPeriod, at = new Date()) {
    const entries = await this.prisma.payrollEntry.findMany({
      where: { periodId: period.id },
      include: { worker: { select: { firstName: true, lastName: true, docNumber: true, site: { select: { name: true } } } } },
    });
    const periodDays = daysBetween(period.startDate, period.endDate) + 1;
    const elapsed = Math.min(periodDays, Math.max(0, daysBetween(period.startDate, at) + 1));
    const rows = entries.map((e) => {
      const salary = Math.round((e.baseSalary / 30) * Math.min(periodDays, 30));
      const days = e.workedDays ? Math.min(e.workedDays, elapsed) : elapsed;
      const accumulated = Math.round((salary / periodDays) * days) + e.overtimeAmount + e.surcharges;
      const projected = salary + e.overtimeAmount + e.surcharges;
      return { ...e, site: e.worker.site?.name ?? 'Sin sede', salary, accumulated, projected };
    });
    return {
      rows,
      elapsed,
      periodDays,
      accumulated: sum(rows, (r) => r.accumulated),
      projected: sum(rows, (r) => r.projected),
      baseTotal: sum(rows, (r) => r.salary),
      overtimeHours: sum(rows, (r) => r.overtimeHours),
      overtimeAmount: sum(rows, (r) => r.overtimeAmount),
      surcharges: sum(rows, (r) => r.surcharges),
      deductions: sum(rows, (r) => r.deductions),
    };
  }

  private async previous(period: PayrollPeriod) {
    return this.prisma.payrollPeriod.findFirst({
      where: { companyId: period.companyId, startDate: { lt: period.startDate } },
      orderBy: { startDate: 'desc' },
    });
  }

  @Get('overview')
  async overview(@CurrentUser() u: AuthUser, @Query('periodId') periodId?: string) {
    const companyId = requireCompany(u);
    const period = await this.resolvePeriod(companyId, periodId);
    const [p, workers, advances, prev] = await Promise.all([
      this.payroll(period),
      this.prisma.worker.groupBy({ by: ['status', 'enabled'], where: { companyId }, _count: true }),
      this.prisma.advance.findMany({ where: { periodId: period.id, status: 'DISBURSED' }, select: { amount: true, workerId: true } }),
      this.previous(period),
    ]);
    const prevAdv = prev ? await this.prisma.advance.aggregate({ where: { periodId: prev.id, status: 'DISBURSED' }, _sum: { amount: true }, _count: true }) : null;
    const count = (f: (g: (typeof workers)[number]) => boolean) => sum(workers.filter(f), (g) => g._count);
    const advanced = sum(advances, (a) => a.amount);
    return {
      period: { id: period.id, label: period.label, status: period.status, startDate: period.startDate, endDate: period.endDate, payDate: period.payDate },
      workers: {
        total: count((g) => g.status !== 'RETIRED'),
        enabled: count((g) => g.enabled && g.status !== 'RETIRED'),
        active: count((g) => g.status === 'ACTIVE'),
        users: new Set(advances.map((a) => a.workerId)).size,
      },
      payroll: { accumulated: p.accumulated, projected: p.projected, overtimeAmount: p.overtimeAmount, surcharges: p.surcharges, budget: period.budget === null ? null : Number(period.budget) },
      ewa: {
        withdrawals: advances.length,
        withdrawn: advanced,
        shareOfPayrollPct: pct(advanced, p.projected),
        vsPrevious: prevAdv ? { withdrawn: prevAdv._sum.amount ?? 0, withdrawals: prevAdv._count, changePct: pct(advanced - (prevAdv._sum.amount ?? 0), prevAdv._sum.amount ?? 0) } : null,
      },
      attention: await this.attentionList(companyId, period),
    };
  }

  @Get('payroll')
  async payrollDetail(@CurrentUser() u: AuthUser, @Query('periodId') periodId?: string) {
    const period = await this.resolvePeriod(requireCompany(u), periodId);
    const p = await this.payroll(period);
    const bySite = new Map<string, { site: string; workers: number; projected: number; overtimeHours: number; overtimeAmount: number; surcharges: number }>();
    for (const r of p.rows) {
      const cur = bySite.get(r.site) ?? { site: r.site, workers: 0, projected: 0, overtimeHours: 0, overtimeAmount: 0, surcharges: 0 };
      cur.workers++;
      cur.projected += r.projected;
      cur.overtimeHours += r.overtimeHours;
      cur.overtimeAmount += r.overtimeAmount;
      cur.surcharges += r.surcharges;
      bySite.set(r.site, cur);
    }
    const budget = period.budget === null ? null : Number(period.budget);
    return {
      period: { id: period.id, label: period.label },
      progress: { elapsedDays: p.elapsed, periodDays: p.periodDays, pct: pct(p.elapsed, p.periodDays) },
      accumulated: p.accumulated,
      projected: p.projected,
      baseTotal: p.baseTotal,
      overtime: { hours: p.overtimeHours, amount: p.overtimeAmount, shareOfPayrollPct: pct(p.overtimeAmount, p.projected) },
      surcharges: { amount: p.surcharges, shareOfPayrollPct: pct(p.surcharges, p.projected) },
      budget: budget === null ? null : { budget, projected: p.projected, executed: p.accumulated, executionPct: pct(p.accumulated, budget), projectedDeviation: p.projected - budget, projectedDeviationPct: pct(p.projected - budget, budget) },
      bySite: [...bySite.values()],
      topOvertime: [...p.rows].sort((a, b) => b.overtimeAmount - a.overtimeAmount).slice(0, 10).map((r) => ({ name: `${r.worker.firstName} ${r.worker.lastName}`, site: r.site, hours: r.overtimeHours, amount: r.overtimeAmount })),
    };
  }

  // Per-worker variations against the previous period (salary, overtime, surcharges).
  @Get('variations')
  async variations(@CurrentUser() u: AuthUser, @Query('periodId') periodId?: string, @Query('threshold') threshold = '20') {
    const period = await this.resolvePeriod(requireCompany(u), periodId);
    const prev = await this.previous(period);
    if (!prev) return { period: period.label, previous: null, items: [] };
    const [cur, before] = await Promise.all([this.payroll(period, period.endDate), this.payroll(prev, prev.endDate)]);
    const limit = Number(threshold) || 20;
    const items = [];
    for (const r of cur.rows) {
      const b = before.rows.find((x) => x.workerId === r.workerId);
      if (!b) {
        items.push({ workerId: r.workerId, name: `${r.worker.firstName} ${r.worker.lastName}`, site: r.site, concept: 'Nuevo en nómina', previous: 0, current: r.projected, changePct: 100 });
        continue;
      }
      for (const [concept, now, then] of [
        ['Salario base', r.baseSalary, b.baseSalary],
        ['Horas extra', r.overtimeAmount, b.overtimeAmount],
        ['Recargos', r.surcharges, b.surcharges],
        ['Total devengado', r.projected, b.projected],
      ] as const) {
        const change = then ? pct(now - then, then) : now ? 100 : 0;
        if (Math.abs(change) >= limit) items.push({ workerId: r.workerId, name: `${r.worker.firstName} ${r.worker.lastName}`, site: r.site, concept, previous: then, current: now, changePct: change });
      }
    }
    return {
      period: period.label,
      previous: prev.label,
      totals: { current: cur.projected, previous: before.projected, changePct: pct(cur.projected - before.projected, before.projected) },
      items: items.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    };
  }

  // Trends across the last N periods.
  @Get('trends')
  async trends(@CurrentUser() u: AuthUser, @Query('limit') limit = '6') {
    const companyId = requireCompany(u);
    const periods = (await this.prisma.payrollPeriod.findMany({ where: { companyId }, orderBy: { startDate: 'desc' }, take: Math.min(Math.max(Number(limit) || 6, 1), 24) })).reverse();
    const out = [];
    for (const period of periods) {
      const [p, adv] = await Promise.all([
        this.payroll(period, period.status === 'OPEN' ? new Date() : period.endDate),
        this.prisma.advance.findMany({ where: { periodId: period.id, status: 'DISBURSED' }, select: { amount: true, workerId: true } }),
      ]);
      out.push({
        periodId: period.id,
        label: period.label,
        status: period.status,
        payroll: p.projected,
        budget: period.budget === null ? null : Number(period.budget),
        overtimeAmount: p.overtimeAmount,
        overtimeHours: p.overtimeHours,
        surcharges: p.surcharges,
        withdrawn: sum(adv, (a) => a.amount),
        withdrawals: adv.length,
        users: new Set(adv.map((a) => a.workerId)).size,
      });
    }
    return out;
  }

  @Get('compare')
  async compare(@CurrentUser() u: AuthUser, @Query('a') a: string, @Query('b') b: string) {
    if (!a || !b) throw new BadRequestException('Indica los periodos a y b');
    const companyId = requireCompany(u);
    const [pa, pb] = await Promise.all([this.resolvePeriod(companyId, a), this.resolvePeriod(companyId, b)]);
    const metrics = async (period: PayrollPeriod) => {
      const p = await this.payroll(period, period.status === 'OPEN' ? new Date() : period.endDate);
      const adv = await this.prisma.advance.aggregate({ where: { periodId: period.id, status: 'DISBURSED' }, _sum: { amount: true }, _count: true });
      return { label: period.label, workers: p.rows.length, payroll: p.projected, overtimeAmount: p.overtimeAmount, overtimeHours: p.overtimeHours, surcharges: p.surcharges, deductions: p.deductions, withdrawn: adv._sum.amount ?? 0, withdrawals: adv._count };
    };
    const [ma, mb] = await Promise.all([metrics(pa), metrics(pb)]);
    const delta = Object.fromEntries(
      Object.entries(mb)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => [k, { diff: (v as number) - (ma[k as keyof typeof ma] as number), pct: pct((v as number) - (ma[k as keyof typeof ma] as number), ma[k as keyof typeof ma] as number) }]),
    );
    return { a: ma, b: mb, delta };
  }

  // FLEXA usage: weekly, monthly, by category, by weekday and by site.
  @Get('usage')
  async usage(@CurrentUser() u: AuthUser, @Query('months') months = '6') {
    const companyId = requireCompany(u);
    const from = new Date();
    from.setMonth(from.getMonth() - Math.min(Math.max(Number(months) || 6, 1), 36) + 1, 1);
    from.setHours(0, 0, 0, 0);
    const [advances, payments, period] = await Promise.all([
      this.prisma.advance.findMany({
        where: { status: 'DISBURSED', worker: { companyId }, createdAt: { gte: from } },
        select: { amount: true, createdAt: true, periodId: true, workerId: true, worker: { select: { site: { select: { name: true } } } } },
      }),
      this.prisma.servicePayment.findMany({ where: { worker: { companyId }, createdAt: { gte: from } }, select: { amount: true, category: true } }),
      this.resolvePeriod(companyId),
    ]);

    const monthly = new Map<string, number>();
    for (let d = new Date(from); d <= new Date(); d.setMonth(d.getMonth() + 1)) monthly.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    for (const a of advances) {
      const k = `${a.createdAt.getFullYear()}-${a.createdAt.getMonth()}`;
      monthly.set(k, (monthly.get(k) ?? 0) + a.amount);
    }

    const inPeriod = advances.filter((a) => a.periodId === period.id);
    const weeks = Math.ceil((daysBetween(period.startDate, period.endDate) + 1) / 7);
    const weekly = Array.from({ length: weeks }, (_, i) => ({
      week: `Sem ${i + 1}`,
      value: sum(inPeriod.filter((a) => Math.floor((+a.createdAt - +period.startDate) / (7 * DAY)) === i), (a) => a.amount),
    }));

    const weekday = WEEKDAYS.map((day, i) => ({ day, value: sum(advances.filter((a) => a.createdAt.getDay() === i), (a) => a.amount) })).filter((d, i) => i > 0 && i < 6 || d.value > 0);

    const sites = new Map<string, number>();
    for (const a of advances) sites.set(a.worker.site?.name ?? 'Sin sede', (sites.get(a.worker.site?.name ?? 'Sin sede') ?? 0) + a.amount);
    const siteTotal = sum([...sites.values()], (v) => v);

    const cats = new Map<string, number>();
    for (const p of payments) cats.set(p.category, (cats.get(p.category) ?? 0) + p.amount);
    cats.set('Retiros a cuenta', sum(advances, (a) => a.amount));
    const catTotal = sum([...cats.values()], (v) => v);

    return {
      period: { id: period.id, label: period.label },
      weekly,
      monthly: [...monthly.entries()].map(([k, value]) => ({ month: MONTHS[Number(k.split('-')[1])], value })),
      weekday,
      bySite: [...sites.entries()].map(([name, value]) => ({ name, value, pct: pct(value, siteTotal) })).sort((a, b) => b.value - a.value),
      categories: [...cats.entries()].map(([name, value]) => ({ name, value, pct: pct(value, catTotal) })).sort((a, b) => b.value - a.value),
      totals: { withdrawn: sum(advances, (a) => a.amount), withdrawals: advances.length, users: new Set(advances.map((a) => a.workerId)).size },
    };
  }

  @Get('attention')
  async attention(@CurrentUser() u: AuthUser) {
    const companyId = requireCompany(u);
    return this.attentionList(companyId, await this.resolvePeriod(companyId));
  }

  // Indicators that need someone to look at them.
  private async attentionList(companyId: string, period: PayrollPeriod) {
    const out: { level: 'INFO' | 'WARNING' | 'CRITICAL'; title: string; detail: string }[] = [];
    const [p, exceptions, failed, incidents, issues, prev, highUsers] = await Promise.all([
      this.payroll(period),
      this.prisma.advance.count({ where: { periodId: period.id, status: 'EXCEPTION' } }),
      this.prisma.advance.count({ where: { periodId: period.id, status: 'FAILED' } }),
      this.prisma.incident.count({ where: { companyId, status: { in: ['OPEN', 'ESCALATED'] } } }),
      this.prisma.payrollIssue.count({ where: { upload: { companyId }, resolved: false, severity: 'ERROR' } }),
      this.previous(period),
      this.prisma.advance.groupBy({ by: ['workerId'], where: { periodId: period.id, status: 'DISBURSED' }, _count: true, having: { workerId: { _count: { gte: 3 } } } }),
    ]);
    if (exceptions) out.push({ level: 'WARNING', title: `${exceptions} solicitudes en excepción`, detail: 'Requieren aprobación o rechazo de Talento Humano' });
    if (failed) out.push({ level: 'CRITICAL', title: `${failed} desembolsos fallidos`, detail: 'Revisa las cuentas de destino y reintenta' });
    if (incidents) out.push({ level: 'WARNING', title: `${incidents} incidencias abiertas`, detail: 'Casos sin resolver en la operación' });
    if (issues) out.push({ level: 'WARNING', title: `${issues} inconsistencias de nómina`, detail: 'Pueden afectar el cálculo del devengado' });
    if (period.budget !== null && p.projected > Number(period.budget))
      out.push({ level: 'CRITICAL', title: 'Nómina proyectada sobre el presupuesto', detail: `Desviación de ${pct(p.projected - Number(period.budget), Number(period.budget))} %` });
    if (p.projected && pct(p.overtimeAmount, p.projected) > 8) out.push({ level: 'WARNING', title: 'Horas extra altas', detail: `Representan el ${pct(p.overtimeAmount, p.projected)} % de la nómina` });
    if (prev) {
      const before = await this.payroll(prev, prev.endDate);
      const change = pct(p.overtimeAmount - before.overtimeAmount, before.overtimeAmount);
      if (before.overtimeAmount && change > 25) out.push({ level: 'INFO', title: 'Horas extra en aumento', detail: `+${change} % frente a ${prev.label}` });
    }
    if (highUsers.length) out.push({ level: 'INFO', title: `${highUsers.length} trabajadores con 3 o más retiros`, detail: 'Pueden beneficiarse de acompañamiento financiero' });
    return out;
  }

  @Get('reports/:type')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async report(@CurrentUser() u: AuthUser, @Param('type') type: string, @Query('periodId') periodId?: string) {
    const companyId = requireCompany(u);
    if (type === 'payroll') {
      const period = await this.resolvePeriod(companyId, periodId);
      const p = await this.payroll(period);
      return toCsv(p.rows.map((r) => ({ periodo: period.label, documento: r.worker.docNumber, nombre: `${r.worker.firstName} ${r.worker.lastName}`, sede: r.site, salario_base: r.baseSalary, horas_extra: r.overtimeHours, valor_horas_extra: r.overtimeAmount, recargos: r.surcharges, deducciones: r.deductions, acumulado: r.accumulated, proyectado: r.projected })));
    }
    if (type === 'usage') {
      const period = await this.resolvePeriod(companyId, periodId);
      const adv = await this.prisma.advance.findMany({ where: { periodId: period.id }, include: { worker: { select: { firstName: true, lastName: true, docNumber: true } }, bankAccount: { select: { bank: true } } }, orderBy: { createdAt: 'asc' } });
      return toCsv(adv.map((a) => ({ codigo: a.code, fecha: a.createdAt, documento: a.worker.docNumber, nombre: `${a.worker.firstName} ${a.worker.lastName}`, monto: a.amount, comision: a.fee, banco: a.bankAccount.bank, estado: a.status, sobre_recomendado: a.overRecommended ? 'SI' : 'NO' })));
    }
    if (type === 'trends') return toCsv(await this.trends(u));
    if (type === 'variations') {
      const v = await this.variations(u, periodId);
      return toCsv(v.items);
    }
    throw new BadRequestException('Tipos de reporte: payroll, usage, trends, variations');
  }
}
