"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Banknote, Clock, Download, FileText, Flame, Scale, TrendingUp } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { GroupBars, Legend } from "@/components/flexa/empresas/charts";
import { Delta, EmptyState, ErrorState, FormField, Loading, Notice, PageLoading, pct, SectionCard, Select, TextInput, useAction, useQueryState } from "@/components/flexa/empresas/kit";
import type { Period } from "@/components/flexa/empresas/types";
import { CardHead, Kpi } from "@/components/flexa/empresas-ui";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button, Card, IconBox } from "@/components/flexa/ui";
import { download, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "nomina", label: "Nómina" },
  { value: "variaciones", label: "Variaciones" },
  { value: "tendencias", label: "Tendencias" },
  { value: "comparar", label: "Comparar periodos" },
  { value: "reportes", label: "Reportes" },
] as const;

function Stats() {
  const [tab, setTab] = useQueryState("tab", "nomina");
  const [periodId, setPeriodId] = useQueryState("periodo");
  const periods = useApi<Period[]>("/payroll/periods");
  const withPeriod = tab === "nomina" || tab === "variaciones" || tab === "reportes";
  const tabsBox = useRef<HTMLDivElement>(null);
  // Keep the active tab visible when the track scrolls on narrow screens.
  useEffect(() => {
    const box = tabsBox.current;
    const on = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !on) return;
    const offset = on.getBoundingClientRect().left - box.getBoundingClientRect().left;
    box.scrollTo({ left: box.scrollLeft + offset - (box.clientWidth - on.offsetWidth) / 2 });
  }, [tab]);
  return (
    <>
      <PageHeader
        title="Estadísticas"
        sub="Payroll Intelligence: comportamiento de la nómina, sus variaciones y tendencias."
        action={
          withPeriod &&
          periods.data && (
            <Select aria-label="Periodo" value={periodId} onChange={(e) => setPeriodId(e.target.value)} options={periods.data.map((p) => ({ value: p.id, label: p.label }))} placeholder="Periodo actual" className="w-full sm:w-52" />
          )
        }
      />
      {/* Five tabs do not fit below sm: the track keeps its natural width and scrolls inside this box. */}
      <div ref={tabsBox} className="overflow-x-auto [scrollbar-width:none]">
        <PillTabs variant="segmented" className="min-w-max" options={tabs} value={tab as (typeof tabs)[number]["value"]} onChange={setTab} />
      </div>
      {tab === "nomina" && <PayrollTab periodId={periodId} />}
      {tab === "variaciones" && <VariationsTab periodId={periodId} />}
      {tab === "tendencias" && <TrendsTab />}
      {tab === "comparar" && <CompareTab periods={periods.data ?? []} />}
      {tab === "reportes" && <ReportsTab periodId={periodId} />}
    </>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Stats />
    </Suspense>
  );
}

const q = (periodId: string, extra = "") => {
  const p = new URLSearchParams(extra);
  if (periodId) p.set("periodId", periodId);
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ---------- Nómina ----------

type Payroll = {
  period: { label: string };
  progress: { elapsedDays: number; periodDays: number; pct: number };
  accumulated: number;
  projected: number;
  baseTotal: number;
  overtime: { hours: number; amount: number; shareOfPayrollPct: number };
  surcharges: { amount: number; shareOfPayrollPct: number };
  budget: { budget: number | null; projected: number; executed: number; executionPct: number | null; projectedDeviation: number | null; projectedDeviationPct: number | null };
  bySite: { site: string; workers: number; projected: number; overtimeHours: number; overtimeAmount: number; surcharges: number }[];
  topOvertime: { name: string; site: string; hours: number; amount: number }[];
};

function PayrollTab({ periodId }: { periodId: string }) {
  const { data: d, error, loading, reload } = useApi<Payroll>(`/analytics/payroll${q(periodId)}`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !d) return <Loading rows={6} />;
  if (!d) return null;
  const b = d.budget;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} value={money(d.accumulated)} label={`Acumulado a hoy · día ${d.progress.elapsedDays} de ${d.progress.periodDays}`} />
        <Kpi icon={TrendingUp} value={money(d.projected)} label="Nómina proyectada al cierre" tone="teal" />
        <Kpi icon={Clock} value={money(d.overtime.amount)} label={`Horas extra · ${d.overtime.hours} h · ${pct(d.overtime.shareOfPayrollPct)}`} tone="amber" />
        <Kpi icon={Flame} value={money(d.surcharges.amount)} label={`Recargos · ${pct(d.surcharges.shareOfPayrollPct)} de la nómina`} tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <SectionCard>
          <CardHead title="Presupuesto frente a ejecución" sub={d.period.label} />
          {b.budget ? (
            <>
              <div className="flex flex-col gap-3">
                <Meter label="Ejecutado" value={b.executed} max={b.budget} tone="green" />
                <Meter label="Proyectado" value={b.projected} max={b.budget} tone={b.projected > b.budget ? "amber" : "teal"} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Box label="Presupuesto" value={money(b.budget)} />
                <Box label="Desviación proyectada" value={<span className={cn((b.projectedDeviation ?? 0) > 0 ? "text-warning" : "text-green-700")}>{money(b.projectedDeviation)} <span className="text-sm">({pct(b.projectedDeviationPct)})</span></span>} />
              </div>
            </>
          ) : (
            <EmptyState icon={Scale} title="Sin presupuesto" text="Define el presupuesto del periodo en Nómina › Periodos para comparar la ejecución." />
          )}
        </SectionCard>

        {/* Single column below xl: let the table scroll inside the card instead of widening the grid track (14px page overflow at 1024). */}
        <SectionCard className="lg:min-w-0 xl:min-w-auto">
          <CardHead title="Por sede" sub="Proyectado, horas extra y recargos" />
          <Table>
            <thead><tr><Th>Sede</Th><Th className="text-right">Trabajadores</Th><Th className="text-right">Proyectado</Th><Th className="text-right">Horas extra</Th><Th className="text-right">Valor h. extra</Th><Th className="text-right">Recargos</Th></tr></thead>
            <tbody>
              {d.bySite.map((s) => (
                <tr key={s.site}>
                  <Td className="font-bold">{s.site}</Td>
                  <Td className="text-right tabular-nums">{s.workers}</Td>
                  <Td className="text-right tabular-nums">{money(s.projected)}</Td>
                  <Td className="text-right tabular-nums">{s.overtimeHours}</Td>
                  <Td className="text-right tabular-nums">{money(s.overtimeAmount)}</Td>
                  <Td className="text-right tabular-nums">{money(s.surcharges)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      </div>

      <SectionCard>
        <CardHead title="Más horas extra" sub="Trabajadores con mayor valor de horas extra en el periodo" />
        {d.topOvertime.length ? (
          <Table>
            <thead><tr><Th>Trabajador</Th><Th>Sede</Th><Th className="text-right">Horas</Th><Th className="text-right">Valor</Th></tr></thead>
            <tbody>
              {d.topOvertime.map((t) => (
                <tr key={t.name}>
                  <Td className="font-bold">{t.name}</Td>
                  <Td className="text-ink-2">{t.site}</Td>
                  <Td className="text-right tabular-nums">{t.hours}</Td>
                  <Td className="text-right font-bold tabular-nums">{money(t.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Sin horas extra en el periodo" />
        )}
      </SectionCard>
    </>
  );
}

function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: "green" | "teal" | "amber" }) {
  const p = max ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px] font-bold">
        <span className="text-ink-2">{label}</span>
        <span className="text-ink tabular-nums">{money(value)} · {pct(p)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-green-100">
        <div
          className={cn("h-full rounded-full", tone === "amber" ? "bg-linear-to-r from-[#f2c14e] to-warning-icon" : tone === "teal" ? "bg-teal" : "bg-btn-primary")}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-mint-1 p-3.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <p className="text-lg font-extrabold tracking-[-0.02em] text-ink tabular-nums">{value}</p>
    </div>
  );
}

// ---------- Variaciones ----------

type Variations = {
  period: string;
  previous: string | null;
  totals: { current: number; previous: number; changePct: number };
  items: { workerId: string; name: string; site: string; concept: string; previous: number; current: number; changePct: number }[];
};

function VariationsTab({ periodId }: { periodId: string }) {
  const [threshold, setThreshold] = useState("20");
  const t = Math.max(1, Number(threshold) || 20);
  const { data: d, error, loading, reload } = useApi<Variations>(`/analytics/variations${q(periodId, `threshold=${t}`)}`);
  const [concept, setConcept] = useState("");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !d) return <Loading rows={6} />;
  if (!d) return null;
  const concepts = [...new Set(d.items.map((i) => i.concept))];
  const items = d.items.filter((i) => !concept || i.concept === concept);
  return (
    <SectionCard>
      <CardHead
        title={`Variaciones ${d.period}${d.previous ? ` frente a ${d.previous}` : ""}`}
        sub={`Nómina total ${money(d.totals.current)} · cambio general`}
        action={<Delta value={d.totals.changePct} goodWhenUp={false} />}
      />
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Umbral de cambio (%)" className="w-full sm:w-44"><TextInput type="number" min={1} max={500} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></FormField>
        <FormField label="Concepto" className="w-full sm:w-52">
          <Select value={concept} onChange={(e) => setConcept(e.target.value)} options={concepts.map((c) => ({ value: c, label: c }))} placeholder="Todos" />
        </FormField>
        <span className="ml-auto text-sm font-semibold text-ink-2 tabular-nums sm:mb-3">{items.length} variaciones</span>
      </div>
      {items.length ? (
        <Table>
          <thead><tr><Th>Trabajador</Th><Th>Sede</Th><Th>Concepto</Th><Th className="text-right">Anterior</Th><Th className="text-right">Actual</Th><Th className="text-right">Cambio</Th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.workerId + i.concept}>
                <Td className="font-bold">{i.name}</Td>
                <Td className="text-ink-2">{i.site}</Td>
                <Td>{i.concept}</Td>
                <Td className="text-right tabular-nums">{money(i.previous)}</Td>
                <Td className="text-right tabular-nums">{money(i.current)}</Td>
                <Td className="text-right"><Delta value={i.changePct} goodWhenUp={false} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="Sin variaciones relevantes" text={`Ningún concepto cambió más de ${t}% frente al periodo anterior.`} />
      )}
    </SectionCard>
  );
}

// ---------- Tendencias ----------

type Trend = { periodId: string; label: string; payroll: number; budget: number | null; overtimeAmount: number; overtimeHours: number; surcharges: number; withdrawn: number; withdrawals: number; users: number };

function TrendsTab() {
  const [limit, setLimit] = useState("6");
  const { data, error, loading, reload } = useApi<Trend[]>(`/analytics/trends?limit=${limit}`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading rows={6} />;
  if (!data?.length) return <EmptyState title="Sin periodos para comparar" />;
  const pay = [
    { key: "payroll", name: "Nómina", color: "#7cc383" },
    { key: "budget", name: "Presupuesto", color: "#1f6633", line: true },
  ];
  const extras = [
    { key: "overtimeAmount", name: "Horas extra", color: "#4fa95c" },
    { key: "surcharges", name: "Recargos", color: "#23707a" },
    { key: "withdrawn", name: "Retirado con Flexa", color: "#b07800" },
  ];
  return (
    <>
      <div className="flex justify-end">
        <PillTabs options={[{ value: "3", label: "3 periodos" }, { value: "6", label: "6 periodos" }, { value: "12", label: "12 periodos" }] as const} value={limit as "3"} onChange={setLimit} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard>
          <CardHead title="Nómina frente a presupuesto" action={<Legend series={pay} />} />
          <GroupBars data={data} x="label" series={pay} />
        </SectionCard>
        <SectionCard>
          <CardHead title="Horas extra, recargos y retiros" action={<Legend series={extras} />} />
          <GroupBars data={data} x="label" series={extras} />
        </SectionCard>
      </div>
      <SectionCard>
        <Table>
          <thead><tr><Th>Periodo</Th><Th className="text-right">Nómina</Th><Th className="text-right">Presupuesto</Th><Th className="text-right">Horas extra</Th><Th className="text-right">Recargos</Th><Th className="text-right">Retirado</Th><Th className="text-right">Retiros</Th><Th className="text-right">Usuarios</Th></tr></thead>
          <tbody>
            {[...data].reverse().map((t) => (
              <tr key={t.periodId}>
                <Td className="font-bold">{t.label}</Td>
                <Td className="text-right tabular-nums">{money(t.payroll)}</Td>
                <Td className="text-right tabular-nums">{t.budget ? money(t.budget) : "—"}</Td>
                <Td className="text-right tabular-nums">{money(t.overtimeAmount)} <span className="text-ink-3">· {t.overtimeHours} h</span></Td>
                <Td className="text-right tabular-nums">{money(t.surcharges)}</Td>
                <Td className="text-right tabular-nums">{money(t.withdrawn)}</Td>
                <Td className="text-right tabular-nums">{t.withdrawals}</Td>
                <Td className="text-right tabular-nums">{t.users}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </>
  );
}

// ---------- Comparar ----------

type Side = { label: string; workers: number; payroll: number; overtimeAmount: number; overtimeHours: number; surcharges: number; deductions: number; withdrawn: number; withdrawals: number };
type Compare = { a: Side; b: Side; delta: Record<keyof Omit<Side, "label">, { diff: number; pct: number }> };

const compareRows: [keyof Omit<Side, "label">, string, boolean][] = [
  ["workers", "Trabajadores", false],
  ["payroll", "Nómina", true],
  ["overtimeAmount", "Valor horas extra", true],
  ["overtimeHours", "Horas extra", false],
  ["surcharges", "Recargos", true],
  ["deductions", "Deducciones", true],
  ["withdrawn", "Retirado con Flexa", true],
  ["withdrawals", "Número de retiros", false],
];

function CompareTab({ periods }: { periods: Period[] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const pa = a || periods[0]?.id || "";
  const pb = b || periods[1]?.id || "";
  const { data: d, error, loading, reload } = useApi<Compare>(pa && pb && pa !== pb ? `/analytics/compare?a=${pa}&b=${pb}` : null);
  const options = periods.map((p) => ({ value: p.id, label: p.label }));
  return (
    <SectionCard>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Periodo A" className="w-full sm:w-52"><Select value={pa} onChange={(e) => setA(e.target.value)} options={options} /></FormField>
        <FormField label="Periodo B" className="w-full sm:w-52"><Select value={pb} onChange={(e) => setB(e.target.value)} options={options} /></FormField>
      </div>
      {periods.length < 2 ? (
        <EmptyState title="Necesitas al menos dos periodos" />
      ) : pa === pb ? (
        <Notice tone="amber">Elige dos periodos distintos.</Notice>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !d ? (
        <Loading rows={6} />
      ) : (
        <>
          <GroupBars
            height={240}
            minGroup={120}
            data={compareRows.filter(([k]) => ["overtimeAmount", "surcharges", "deductions", "withdrawn"].includes(k)).map(([k, label]) => ({ name: label, a: d.a[k], b: d.b[k] }))}
            x="name"
            series={[
              { key: "a", name: d.a.label, color: "#2b7f40" },
              { key: "b", name: d.b.label, color: "#a8d6a6" },
            ]}
          />
          <Table>
            <thead><tr><Th>Concepto</Th><Th className="text-right">{d.a.label}</Th><Th className="text-right">{d.b.label}</Th><Th className="text-right">Diferencia</Th><Th className="text-right">Cambio</Th></tr></thead>
            <tbody>
              {compareRows.map(([k, label, isMoney]) => {
                const f = (n: number) => (isMoney ? money(n) : n.toLocaleString("es-CO"));
                return (
                  <tr key={k}>
                    <Td className="font-bold">{label}</Td>
                    <Td className="text-right tabular-nums">{f(d.a[k])}</Td>
                    <Td className="text-right tabular-nums">{f(d.b[k])}</Td>
                    <Td className="text-right tabular-nums">{d.delta[k].diff > 0 ? "+" : ""}{f(d.delta[k].diff)}</Td>
                    <Td className="text-right"><Delta value={d.delta[k].pct} goodWhenUp={k === "withdrawals" || k === "workers"} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="text-[13px] font-medium text-ink-3">Diferencia = {d.a.label} − {d.b.label}.</p>
        </>
      )}
    </SectionCard>
  );
}

// ---------- Reportes ----------

const reports = [
  { type: "payroll", title: "Nómina del periodo", text: "Salario, horas extra, recargos, deducciones, acumulado y proyectado por trabajador." },
  { type: "usage", title: "Uso de Flexa", text: "Retiros, montos y usuarios por trabajador y sede." },
  { type: "trends", title: "Tendencias", text: "Nómina, presupuesto, horas extra y retiros de los últimos periodos." },
  { type: "variations", title: "Variaciones", text: "Cambios relevantes por trabajador frente al periodo anterior." },
];

function ReportsTab({ periodId }: { periodId: string }) {
  const { busy, error, run, setError } = useAction();
  const [current, setCurrent] = useState<string | null>(null);
  return (
    <>
      {error && <Notice tone="red" onClose={() => setError(null)}>{error}</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.type} className="flex flex-wrap items-center gap-4 p-5 lg:flex-nowrap">
            <IconBox tone="green" size="lg"><FileText /></IconBox>
            <div className="flex min-w-48 flex-1 flex-col gap-0.5 lg:min-w-0">
              <span className="text-[15px] font-bold text-ink">{r.title}</span>
              <span className="text-[13px] font-medium text-ink-2">{r.text}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy && current === r.type}
              onClick={async () => {
                setCurrent(r.type);
                await run(() => download(`/analytics/reports/${r.type}${q(periodId)}`, `flexa-${r.type}.csv`));
                setCurrent(null);
              }}
            >
              <Download className="text-green-700" />
              {busy && current === r.type ? "Generando…" : "CSV"}
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
