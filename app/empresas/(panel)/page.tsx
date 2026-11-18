"use client";

import Link from "next/link";
import { useState } from "react";
import { Banknote, CalendarClock, ChevronRight, HandCoins, Info, Smartphone, TriangleAlert, Users } from "@/components/flexa/icons";
import { Bars } from "@/components/flexa/charts";
import { PageHeader } from "@/components/flexa/company-shell";
import { AdvanceBadge, Delta, EmptyState, ErrorState, Loading, PageLoading, pct, useCompanySession } from "@/components/flexa/empresas/kit";
import type { Advance } from "@/components/flexa/empresas/types";
import { Avatar, CardHead, Kpi, MoreLink } from "@/components/flexa/empresas-ui";
import { Blob } from "@/components/flexa/shapes";
import { ButtonLink, Card, IconBox } from "@/components/flexa/ui";
import { dateFmt, money, timeFmt, useApi } from "@/lib/api";

type Overview = {
  period: { id: string; label: string; startDate: string; endDate: string; payDate: string } | null;
  workers: { total: number; enabled: number; active: number; users: number };
  payroll: { accumulated: number; projected: number; overtimeAmount: number; surcharges: number; budget: number | null };
  ewa: { withdrawals: number; withdrawn: number; shareOfPayrollPct: number; vsPrevious: { withdrawn: number; withdrawals: number; changePct: number } | null };
  attention: { level: string; title: string; detail: string }[];
};
type Summary = {
  requests: number;
  disbursedAmount: number;
  averageAmount: number;
  activeUsers: number;
  enabledWorkers: number;
  adoptionPct: number;
  overRecommendedPct: number;
  pendingExceptions: number;
  openIncidents: number;
};
type Usage = { weekly: { week: string; value: number }[] };

// Where each attention item takes the user.
const attentionHref = (title: string) =>
  /excepci/i.test(title) ? "/empresas/operaciones?status=EXCEPTION" : /incidenc/i.test(title) ? "/empresas/operaciones?tab=incidencias" : /nómina|faltan|inconsist/i.test(title) ? "/empresas/nomina" : /concilia/i.test(title) ? "/empresas/conciliacion" : "/empresas/trabajadores";

export default function CompanyHome() {
  const session = useCompanySession();
  // Read the clock only in the browser: `now` is used once the period loads (client fetch).
  const [now] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  const overview = useApi<Overview>("/analytics/overview");
  const summary = useApi<Summary>("/company/ewa/summary");
  const usage = useApi<Usage>("/analytics/usage");
  const recent = useApi<Advance[]>("/company/advances");

  if (overview.loading && !overview.data) return <PageLoading />;
  if (overview.error || !overview.data) return <ErrorState error={overview.error} onRetry={overview.reload} />;
  const o = overview.data;
  const s = summary.data;
  const accessPct = o.workers.total ? Math.round((o.workers.enabled / o.workers.total) * 100) : 0;
  const p = o.period;
  const day = p ? Math.min(Math.max(Math.ceil((now - +new Date(p.startDate)) / 86_400_000), 0), 31) : 0;
  const days = p ? Math.round((+new Date(p.endDate) - +new Date(p.startDate)) / 86_400_000) + 1 : 30;
  const first = session?.user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={first ? `¡Hola, ${first}!` : "Inicio"} sub={p ? `Resumen de la actividad de tu empresa en ${p.label}.` : "No hay un periodo de nómina abierto."} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} value={o.workers.total} label="Trabajadores en nómina" tone="green" />
        <Kpi icon={Smartphone} value={o.workers.enabled} label="Habilitados en Flexa" tone="teal" trend={`${accessPct}%`} />
        <Kpi icon={HandCoins} value={o.ewa.withdrawals} label="Retiros del periodo" tone="amber" trend={o.ewa.vsPrevious ? <Delta value={o.ewa.vsPrevious.changePct} /> : undefined} />
        <Kpi icon={Banknote} value={money(o.ewa.withdrawn)} label={`Retirado · ${pct(o.ewa.shareOfPayrollPct)} de la nómina`} tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card className="flex min-w-0 flex-col gap-5 p-4 sm:p-6 lg:min-w-auto">
          <CardHead title="Retiros de los trabajadores" sub="Monto retirado por semana del periodo" href="/empresas/rendimientos" />
          <div className="flex flex-wrap gap-x-8 gap-y-4 lg:gap-y-8">
            <Stat label="Total del periodo" value={money(o.ewa.withdrawn)} />
            <Stat label="Retiro promedio" value={money(s?.averageAmount)} />
            <Stat label="Usuarios activos" value={s ? `${s.activeUsers} · ${s.adoptionPct}%` : "—"} />
            <Stat label="Sobre el recomendado" value={s ? pct(s.overRecommendedPct, 0) : "—"} />
          </div>
          {usage.error ? <ErrorState error={usage.error} onRetry={usage.reload} /> : usage.data ? <Bars data={usage.data.weekly} x="week" height={250} highlightLast={false} /> : <Loading rows={4} />}
        </Card>

        <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-6 lg:min-w-auto">
          <CardHead title="Para atender" sub="Lo que requiere acción de tu equipo" />
          {o.attention.length ? (
            <ul className="flex flex-1 flex-col gap-2.5">
              {o.attention.map((a) => (
                <li key={a.title}>
                  <Link href={attentionHref(a.title)} className="group flex items-center gap-3.5 rounded-md bg-[#f6faf5] p-3.5 transition-colors duration-150 hover:bg-mint-2">
                    <IconBox tone={a.level === "CRITICAL" ? "red" : a.level === "WARNING" ? "amber" : "teal"}>{a.level === "INFO" ? <Info /> : <TriangleAlert />}</IconBox>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-bold text-ink">{a.title}</span>
                      <span className="text-[13px] font-medium text-ink-2">{a.detail}</span>
                    </span>
                    <ChevronRight className="size-[18px] text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-green-700" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Todo al día" text="No hay excepciones, incidencias ni alertas pendientes." />
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.45fr]">
        <Card tone="mint" className="relative isolate flex min-w-0 flex-col justify-between gap-5 overflow-hidden p-4 sm:p-6 lg:min-w-auto">
          <Blob shape={0} tone="deep" className="-right-16 -bottom-20 -z-10 size-[240px] opacity-60" />
          <div className="flex items-center gap-3.5">
            <IconBox tone="dark" size="lg"><CalendarClock /></IconBox>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-green-800">Próxima nómina</span>
              <span className="text-h2 text-green-900">{p ? dateFmt(p.payDate, { day: "numeric", month: "long" }) : "Sin periodo abierto"}</span>
            </div>
          </div>
          {p && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px] font-bold text-green-900">
                <span>Periodo {p.label}</span>
                <span className="tabular-nums">Día {Math.min(day, days)} de {days}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={day} aria-valuemax={days} aria-label="Avance del periodo">
                <div className="h-full rounded-full bg-btn-primary" style={{ width: `${Math.min((day / days) * 100, 100)}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Devengado a hoy" value={money(o.payroll.accumulated)} />
            <MiniStat label="Nómina proyectada" value={money(o.payroll.projected)} />
            <MiniStat label="A compensar" value={money(o.ewa.withdrawn)} />
            <MiniStat label="Presupuesto" value={o.payroll.budget ? money(o.payroll.budget) : "Sin definir"} />
          </div>
          <ButtonLink href="/empresas/nomina" size="md">Ver estado de la nómina</ButtonLink>
        </Card>

        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-6 lg:min-w-auto">
          <CardHead title="Últimas solicitudes" sub="Movimientos recientes de tus trabajadores" action={<MoreLink href="/empresas/operaciones">Ver todas</MoreLink>} />
          {recent.error ? (
            <ErrorState error={recent.error} onRetry={recent.reload} />
          ) : !recent.data ? (
            <Loading rows={4} />
          ) : !recent.data.length ? (
            <EmptyState icon={HandCoins} title="Aún no hay solicitudes" text="Cuando tus trabajadores retiren su salario devengado aparecerán aquí." />
          ) : (
            <ul className="flex flex-col">
              {recent.data.slice(0, 5).map((r) => {
                const name = `${r.worker?.firstName} ${r.worker?.lastName}`;
                return (
                  <li key={r.id} className="border-b border-line-soft last:border-0">
                    <Link href={`/empresas/operaciones/${r.id}`} className="-mx-2 flex min-h-16 items-center gap-3.5 rounded-md px-2 py-2 transition-colors hover:bg-mint-1 lg:h-16 lg:py-0">
                      <Avatar name={name} className="size-10" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-bold text-ink">{name}</span>
                        <span className="text-[13px] font-medium text-ink-2">
                          {r.worker?.site?.name ?? "Sin sede"} · {dateFmt(r.createdAt, { day: "numeric", month: "short" })}, {timeFmt(r.createdAt)}
                        </span>
                      </span>
                      {/* Below sm the amount sits above the badge; from sm the wrapper vanishes and the row is as before. */}
                      <span className="flex shrink-0 flex-col-reverse items-end gap-1 sm:contents">
                        <AdvanceBadge value={r.status} />
                        <span className="text-right text-[15px] font-bold text-ink tabular-nums sm:w-28">{money(r.amount)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="text-[22px] font-extrabold tracking-[-0.03em] text-ink tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white/80 p-3 shadow-xs sm:p-3.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <p className="text-base font-extrabold tracking-[-0.02em] text-ink tabular-nums sm:text-lg">{value}</p>
    </div>
  );
}
