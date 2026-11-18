"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { HandCoins, Plus, ShieldCheck } from "@/components/flexa/empresas/icons";
import {
  AdvanceBadge,
  advanceStatus,
  Dialog,
  EmptyState,
  ErrorState,
  Facts,
  FormField,
  IncidentBadge,
  incidentCategories,
  incidentStatus,
  Loading,
  Notice,
  pct,
  SectionCard,
  Select,
  TextArea,
  TextInput,
  useAction,
  useCanWrite,
  dateTime,
} from "@/components/flexa/empresas/kit";
import type { Advance, Incident, Period, Settings } from "@/components/flexa/empresas/types";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button } from "@/components/flexa/ui";
import { api, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------- Solicitudes ----------

export function AdvancesTab({
  filters,
  setFilter,
}: {
  filters: { status: string; periodId: string; from: string; to: string; workerId: string };
  setFilter: (k: "status" | "periodId" | "from" | "to" | "workerId", v: string) => void;
}) {
  const periods = useApi<Period[]>("/payroll/periods");
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  const { data, error, loading, reload } = useApi<Advance[]>(`/company/advances?${qs}`);
  const total = (data ?? []).filter((a) => a.status === "DISBURSED").reduce((s, a) => s + a.amount, 0);
  return (
    <SectionCard>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Estado" className="w-full sm:w-48">
          <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} options={Object.entries(advanceStatus).map(([value, [label]]) => ({ value, label }))} placeholder="Todos" />
        </FormField>
        <FormField label="Periodo" className="w-full sm:w-44">
          <Select value={filters.periodId} onChange={(e) => setFilter("periodId", e.target.value)} options={(periods.data ?? []).map((p) => ({ value: p.id, label: p.label }))} placeholder="Todos" />
        </FormField>
        <FormField label="Desde" className="w-full sm:w-44"><TextInput type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} /></FormField>
        <FormField label="Hasta" className="w-full sm:w-44"><TextInput type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} /></FormField>
        {filters.workerId && <Button variant="soft" size="sm" className="mb-0.5 h-11" onClick={() => setFilter("workerId", "")}>Quitar filtro de trabajador</Button>}
        <span className="mb-3 ml-auto text-sm max-sm:ml-0 font-semibold text-ink-2 tabular-nums">{data ? `${data.length} solicitudes · ${money(total)} desembolsado` : ""}</span>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading rows={6} />
      ) : !data?.length ? (
        <EmptyState icon={HandCoins} title="No hay solicitudes" text="Ajusta los filtros para ver otras operaciones." />
      ) : (
        <Table className={cn(loading && "opacity-60")}>
          <thead>
            <tr><Th>Código</Th><Th>Trabajador</Th><Th>Sede</Th><Th>Fecha</Th><Th className="text-right">Monto</Th><Th>Banco</Th><Th>Periodo</Th><Th>Estado</Th></tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-mint-1">
                <Td><Link href={`/empresas/operaciones/${a.id}`} className="font-bold text-green-700 hover:underline">{a.code}</Link></Td>
                <Td className="font-bold">{a.worker?.firstName} {a.worker?.lastName}</Td>
                <Td className="text-ink-2">{a.worker?.site?.name ?? "—"}</Td>
                <Td className="text-ink-2">{dateTime(a.createdAt)}</Td>
                <Td className="text-right font-bold tabular-nums">{money(a.amount)}</Td>
                <Td className="text-ink-2">{a.bankAccount?.bank ?? "—"}</Td>
                <Td className="text-ink-2">{a.period?.label}</Td>
                <Td><AdvanceBadge value={a.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SectionCard>
  );
}

// ---------- Incidencias ----------

export function IncidentsTab() {
  const canWrite = useCanWrite();
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi<Incident[]>(`/company/incidents${status ? `?status=${status}` : ""}`);
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Incident | null>(null);
  return (
    <SectionCard>
      <CardHead
        title="Incidencias"
        sub="Excepciones, desembolsos fallidos, diferencias de conciliación y datos de nómina"
        action={
          <div className="flex items-center gap-3 max-lg:w-full max-lg:flex-wrap">
            <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} options={Object.entries(incidentStatus).map(([value, [label]]) => ({ value, label }))} placeholder="Todos los estados" className="w-full sm:w-48" />
            {canWrite && <Button size="sm" onClick={() => setCreate(true)}><Plus />Nueva incidencia</Button>}
          </div>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading rows={4} />
      ) : !data?.length ? (
        <EmptyState icon={ShieldCheck} title="Sin incidencias" text="No hay casos para este filtro." />
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {data.map((i) => (
            <li key={i.id} className="flex items-start gap-4 py-3.5 max-lg:flex-wrap max-lg:gap-y-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1 max-lg:basis-full">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{i.title}</span>
                  <span className="text-xs font-semibold text-ink-3">{incidentCategories[i.category] ?? i.category}</span>
                </span>
                <span className="text-[13px] font-medium text-ink-2">{i.description}</span>
                <span className="flex flex-wrap gap-3 text-xs font-semibold text-ink-3">
                  <span>{dateTime(i.createdAt)}</span>
                  {i.worker && <span>{i.worker.firstName} {i.worker.lastName}</span>}
                  {i.advance && i.advanceId && <Link href={`/empresas/operaciones/${i.advanceId}`} className="text-green-700 hover:underline">{i.advance.code} · {money(i.advance.amount)}</Link>}
                </span>
                {i.resolution && <span className="text-[13px] font-semibold text-green-800">Resolución: {i.resolution}</span>}
              </div>
              <IncidentBadge value={i.status} />
              {canWrite && i.status !== "RESOLVED" && <Button variant="ghost" size="sm" onClick={() => setEdit(i)}>Gestionar</Button>}
            </li>
          ))}
        </ul>
      )}
      <IncidentCreate open={create} onClose={() => setCreate(false)} onDone={reload} />
      <IncidentUpdate incident={edit} onClose={() => setEdit(null)} onDone={reload} />
    </SectionCard>
  );
}

function IncidentCreate({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const ok = await run(() => api("/company/incidents", { body: { category: f.category, title: f.title, description: f.description } }));
    if (ok) {
      onDone();
      onClose();
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva incidencia"
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Creando…" : "Crear incidencia"}</Button>
        </>
      }
    >
      <FormField label="Categoría"><Select name="category" required options={Object.entries(incidentCategories).filter(([k]) => k !== "ADVANCE_EXCEPTION").map(([value, label]) => ({ value, label }))} /></FormField>
      <FormField label="Título"><TextInput name="title" required minLength={3} /></FormField>
      <FormField label="Descripción"><TextArea name="description" required minLength={5} /></FormField>
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

function IncidentUpdate({ incident, onClose, onDone }: { incident: Incident | null; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  const [status, setStatus] = useState("");
  const current = status || incident?.status || "OPEN";
  async function submit(e: FormEvent<HTMLFormElement>) {
    if (!incident) return;
    const resolution = String(new FormData(e.currentTarget).get("resolution") ?? "").trim();
    const ok = await run(() => api(`/company/incidents/${incident.id}`, { method: "PATCH", body: { status: current, resolution: resolution || undefined } }));
    if (ok) {
      setStatus("");
      onDone();
      onClose();
    }
  }
  return (
    <Dialog
      open={!!incident}
      onClose={() => (setStatus(""), onClose())}
      title="Gestionar incidencia"
      sub={incident?.title}
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </>
      }
    >
      {incident?.category === "ADVANCE_EXCEPTION" && <Notice tone="amber">Las excepciones se cierran al aprobar o rechazar la solicitud desde su detalle.</Notice>}
      <FormField label="Estado"><Select value={current} onChange={(e) => setStatus(e.target.value)} options={Object.entries(incidentStatus).map(([value, [label]]) => ({ value, label }))} /></FormField>
      <FormField label={current === "RESOLVED" ? "Resolución" : "Nota (opcional)"}><TextArea name="resolution" required={current === "RESOLVED"} /></FormField>
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

// ---------- Reglas aplicadas ----------

type Summary = {
  period: { label: string } | null;
  requests: number;
  byStatus: Record<string, number>;
  disbursedAmount: number;
  feesAmount: number;
  averageAmount: number;
  adoptionPct: number;
  overRecommendedPct: number;
  pendingExceptions: number;
  openIncidents: number;
  rules: Settings;
};

export function RulesTab() {
  const { data: s, error, loading, reload } = useApi<Summary>("/company/ewa/summary");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !s) return <Loading rows={5} />;
  if (!s) return null;
  const r = s.rules;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <SectionCard>
        <CardHead title="Reglas aplicadas" sub="Cada solicitud se valida contra estas reglas" action={<Link href="/empresas/configuracion" className="text-[13px] font-bold text-green-700 hover:underline">Editar reglas</Link>} />
        <Facts
          items={[
            ["Tope sobre el neto devengado", `${r.maxAdvancePct}%`],
            ["Recomendado", `${r.recommendedPct}%`],
            ["Monto mínimo / máximo", `${money(r.minAmount)} – ${money(r.maxAmountPerRequest)}`],
            ["Solicitudes por periodo", r.maxRequestsPerPeriod],
            ["Comisión por solicitud", money(r.feePerRequest)],
            ["Bloqueo antes del pago", `${r.blackoutDaysBeforePay} días`],
            ["Revisión manual desde", money(r.exceptionAmount)],
            ["Alarma Flexa", `${r.alarmUsagePct}% del tope o ${r.alarmRequestsCount} retiros`],
          ]}
        />
      </SectionCard>
      <SectionCard>
        <CardHead title={`Utilización ${s.period?.label ?? ""}`} />
        <Facts
          items={[
            ["Solicitudes", s.requests],
            ["Desembolsado", money(s.disbursedAmount)],
            ["Promedio", money(s.averageAmount)],
            ["Comisiones", money(s.feesAmount)],
            ["Adopción", pct(s.adoptionPct, 0)],
            ["Sobre el recomendado", pct(s.overRecommendedPct, 0)],
          ]}
        />
        <ul className="flex flex-wrap gap-2">
          {Object.entries(s.byStatus)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <li key={k} className="flex items-center gap-1.5">
                <AdvanceBadge value={k} />
                <span className="text-sm font-bold text-ink tabular-nums">{n}</span>
              </li>
            ))}
        </ul>
      </SectionCard>
    </div>
  );
}
