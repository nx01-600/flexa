"use client";

import { useState } from "react";
import { Async, CompanySelect, ErrorText, Labeled, PageHeader, Select, Status, Textarea, dateTime, qs, type CompanyRow } from "@/components/flexa/admin/admin-ui";
import { Badge, Button, Card } from "@/components/flexa/ui";
import { api, ApiError, money, useApi } from "@/lib/api";

type Incident = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  company: { name: string };
  worker: { firstName: string; lastName: string } | null;
  advance: { code: string; status: string; amount: number } | null;
};

const categories: Record<string, string> = {
  ADVANCE_EXCEPTION: "Excepción de anticipo",
  PAYROLL_DATA: "Datos de nómina",
  RECONCILIATION: "Conciliación",
  INTEGRATION: "Integración",
  DISBURSEMENT_FAILED: "Desembolso fallido",
};

const statusOptions = [
  ["OPEN", "Abierta"],
  ["IN_PROGRESS", "En curso"],
  ["ESCALATED", "Escalada"],
  ["RESOLVED", "Resuelta"],
] as const;

function IncidentCard({ i, onChanged }: { i: Incident; onChanged: () => void }) {
  const [status, setStatus] = useState(i.status);
  const [resolution, setResolution] = useState(i.resolution ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsResolution = status === "RESOLVED" && !resolution.trim();
  const dirty = status !== i.status || resolution !== (i.resolution ?? "");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/incidents/${i.id}`, { method: "PATCH", body: { status, resolution: resolution.trim() || undefined } });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo actualizar la incidencia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[17px] font-extrabold text-ink">{i.title}</h2>
          <p className="text-[13px] font-semibold text-ink-2">
            {i.company.name}
            {i.worker && ` · ${i.worker.firstName} ${i.worker.lastName}`} · {dateTime(i.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="gray">{categories[i.category] ?? i.category}</Badge>
          <Status value={i.status} />
        </div>
      </div>
      <p className="max-w-[75ch] text-[15px] font-medium text-ink-2">{i.description}</p>
      {i.advance && (
        <p className="text-[13px] font-semibold text-ink-2">
          Operación <b className="text-ink">{i.advance.code}</b> · {money(i.advance.amount)} · <Status value={i.advance.status} />
        </p>
      )}
      {i.status === "RESOLVED" ? (
        <p className="rounded-md bg-mint-1 px-4 py-3 text-sm font-medium text-ink">
          <b>Resolución{i.resolvedAt ? ` (${dateTime(i.resolvedAt)})` : ""}:</b> {i.resolution}
        </p>
      ) : (
        <div className="grid gap-3 border-t border-line-soft pt-4 md:grid-cols-[200px_minmax(0,1fr)_auto] md:items-end">
          <Labeled label="Estado">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label={status === "RESOLVED" ? "Resolución (obligatoria)" : "Nota de seguimiento"}>
            <Textarea rows={1} className="min-h-11 py-2.5" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Qué se hizo y con quién se acordó" />
          </Labeled>
          <Button size="sm" disabled={!dirty || needsResolution || busy} onClick={save} className="h-11">
            {busy ? "Guardando…" : "Actualizar"}
          </Button>
          <div className="md:col-span-3">
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Incidents() {
  const [status, setStatus] = useState("");
  const [companyId, setCompanyId] = useState("");
  const companies = useApi<CompanyRow[]>("/admin/companies");
  const state = useApi<Incident[]>(`/admin/incidents${qs({ status, companyId })}`);
  return (
    <>
      <PageHeader title="Incidencias" sub="Excepciones, fallas de desembolso, datos de nómina e integraciones de todas las empresas." />
      <div className="flex flex-wrap items-end gap-4">
        <Labeled label="Estado">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-48">
            <option value="">Todas</option>
            {statusOptions.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Labeled>
        <CompanySelect companies={companies.data} value={companyId} onChange={setCompanyId} />
      </div>
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay incidencias con estos filtros.">
        {(rows) => (
          <div className="flex flex-col gap-4">
            {rows.map((i) => (
              <IncidentCard key={`${i.id}-${i.status}`} i={i} onChanged={state.reload} />
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
