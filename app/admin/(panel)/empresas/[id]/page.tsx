"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChevronLeft } from "@/components/flexa/icons";
import { Async, ErrorText, Labeled, PageHeader, Select, Status, dateTime, roleLabel } from "@/components/flexa/admin/admin-ui";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card, Input } from "@/components/flexa/ui";
import { api, ApiError, dateFmt, money, useApi } from "@/lib/api";

type Settings = Record<(typeof params)[number]["key"], number> & { payFrequency: string };
type Detail = {
  id: string;
  name: string;
  nit: string;
  status: string;
  pricePerWorker: number;
  integrationType: string;
  integrationStatus: string;
  erpName: string | null;
  lastSyncAt: string | null;
  hasApiKey: boolean;
  createdAt: string;
  settings: Settings | null;
  sites: { id: string; name: string; city: string }[];
  users: { id: string; name: string; email: string; role: string; active: boolean }[];
  periods: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    payDate: string;
    status: string;
    reconciliation: { status: string; disbursedTotal: number; compensatedTotal: number; differenceTotal: number } | null;
  }[];
};

const params = [
  { key: "maxAdvancePct", label: "Tope de anticipo", unit: "% del neto" },
  { key: "recommendedPct", label: "Recomendado", unit: "% del neto" },
  { key: "minAmount", label: "Monto mínimo", unit: "COP" },
  { key: "maxAmountPerRequest", label: "Máximo por solicitud", unit: "COP" },
  { key: "maxRequestsPerPeriod", label: "Solicitudes por periodo", unit: "máx." },
  { key: "feePerRequest", label: "Comisión por retiro", unit: "COP" },
  { key: "blackoutDaysBeforePay", label: "Días de bloqueo antes del pago", unit: "días" },
  { key: "alarmUsagePct", label: "Alarma por uso", unit: "% del tope" },
  { key: "alarmRequestsCount", label: "Alarma por número de retiros", unit: "retiros" },
  { key: "exceptionAmount", label: "Umbral de excepción", unit: "COP" },
] as const;

function ServiceForm({ c, onSaved }: { c: Detail; onSaved: () => void }) {
  const [f, setF] = useState({ status: c.status, integrationStatus: c.integrationStatus, pricePerWorker: String(c.pricePerWorker) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = f.status !== c.status || f.integrationStatus !== c.integrationStatus || Number(f.pricePerWorker) !== c.pricePerWorker;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/admin/companies/${c.id}`, { method: "PATCH", body: { ...f, pricePerWorker: Number(f.pricePerWorker) } });
      setMsg({ ok: true, text: "Cambios guardados." });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "No se pudo guardar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <CardHead title="Servicio" sub="Estado del cliente, precio e integración" />
      <form onSubmit={save} className="flex flex-col gap-4">
        <Labeled label="Estado de la empresa">
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="ACTIVE">Activa</option>
            <option value="ONBOARDING">En vinculación</option>
            <option value="SUSPENDED">Suspendida</option>
          </Select>
        </Labeled>
        <Labeled label="Estado de la integración">
          <Select value={f.integrationStatus} onChange={(e) => setF({ ...f, integrationStatus: e.target.value })}>
            <option value="OK">Operando</option>
            <option value="DEGRADED">Degradada</option>
            <option value="DOWN">Caída</option>
            <option value="NOT_CONFIGURED">Sin configurar</option>
          </Select>
        </Labeled>
        <Labeled label="Precio por trabajador habilitado (COP/mes)">
          <Input type="number" min={0} value={f.pricePerWorker} onChange={(e) => setF({ ...f, pricePerWorker: e.target.value })} className="h-11 tabular-nums" />
        </Labeled>
        {msg && (msg.ok ? <p className="text-sm font-semibold text-green-700">{msg.text}</p> : <ErrorText>{msg.text}</ErrorText>)}
        <Button type="submit" size="sm" disabled={!dirty || busy} className="self-end">
          {busy ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line-soft pt-4 text-[13px]">
        <dt className="font-semibold text-ink-2">Tipo de integración</dt>
        <dd className="font-bold text-ink">{c.integrationType === "ERP_API" ? `API ERP${c.erpName ? ` · ${c.erpName}` : ""}` : "Archivo"}</dd>
        <dt className="font-semibold text-ink-2">API key del ERP</dt>
        <dd className="font-bold text-ink">{c.hasApiKey ? "Generada" : "No generada"}</dd>
        <dt className="font-semibold text-ink-2">Última sincronización</dt>
        <dd className="font-bold text-ink">{dateTime(c.lastSyncAt)}</dd>
        <dt className="font-semibold text-ink-2">Cliente desde</dt>
        <dd className="font-bold text-ink">{dateFmt(c.createdAt)}</dd>
      </dl>
    </Card>
  );
}

function SettingsForm({ c, onSaved }: { c: Detail; onSaved: () => void }) {
  const initial = Object.fromEntries(params.map((p) => [p.key, String(c.settings?.[p.key] ?? "")])) as Record<string, string>;
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== initial[k] && v !== ""));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/admin/companies/${c.id}/settings`, { method: "PATCH", body: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, Number(v)])) });
      setMsg({ ok: true, text: "Parámetros actualizados. El cambio queda en la trazabilidad." });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "No se pudo guardar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <CardHead title="Parámetros autorizados" sub="Ajusta las reglas EWA solo con autorización del cliente." />
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {params.map((p) => (
            <Labeled key={p.key} label={`${p.label} (${p.unit})`}>
              <Input type="number" min={0} value={f[p.key]} onChange={(e) => setF({ ...f, [p.key]: e.target.value })} className="h-11 tabular-nums" />
            </Labeled>
          ))}
        </div>
        {msg && (msg.ok ? <p className="text-sm font-semibold text-green-700">{msg.text}</p> : <ErrorText>{msg.text}</ErrorText>)}
        <div className="flex items-center justify-end gap-3">
          {Object.keys(changed).length > 0 && <span className="text-[13px] font-semibold text-ink-2">{Object.keys(changed).length} cambio(s) sin guardar</span>}
          <Button type="submit" size="sm" disabled={!Object.keys(changed).length || busy}>
            {busy ? "Guardando…" : "Guardar parámetros"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const state = useApi<Detail>(`/admin/companies/${id}`);
  return (
    <>
      <Link href="/admin/empresas" className="-mb-3 inline-flex items-center gap-1 self-start text-sm font-bold text-green-700 hover:text-green-900 [&_svg]:size-4">
        <ChevronLeft />
        Empresas
      </Link>
      <Async state={state}>
        {(c) => (
          <>
            <PageHeader
              title={c.name}
              sub={`NIT ${c.nit}`}
              action={
                <div className="flex gap-2">
                  <Status value={c.status} />
                  <Link href={`/admin/trazabilidad?companyId=${c.id}`} className="text-sm font-bold text-green-700 hover:underline">
                    Ver trazabilidad
                  </Link>
                </div>
              }
            />
            <div className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              {/* key remounts the forms with fresh values after a save */}
              <ServiceForm key={`s-${c.status}-${c.integrationStatus}-${c.pricePerWorker}`} c={c} onSaved={state.reload} />
              <SettingsForm key={`p-${JSON.stringify(c.settings)}`} c={c} onSaved={state.reload} />
            </div>

            <Card className="flex flex-col gap-4 p-6">
              <CardHead title="Periodos recientes y conciliación" sub="Últimos 6 periodos de nómina" />
              {c.periods.length === 0 ? (
                <p className="text-sm font-medium text-ink-2">La empresa aún no tiene periodos de nómina.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Periodo</Th>
                      <Th>Pago</Th>
                      <Th>Estado</Th>
                      <Th>Conciliación</Th>
                      <Th className="text-right">Desembolsado</Th>
                      <Th className="text-right">Compensado</Th>
                      <Th className="text-right">Diferencia</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.periods.map((p) => (
                      <tr key={p.id}>
                        <Td className="font-bold">{p.label}</Td>
                        <Td>{dateFmt(p.payDate)}</Td>
                        <Td>
                          <Status value={p.status} label={p.status === "OPEN" ? "Abierto" : p.status === "CLOSED" ? "Cerrado" : undefined} />
                        </Td>
                        <Td>{p.reconciliation ? <Status value={p.reconciliation.status} /> : <span className="text-ink-3">—</span>}</Td>
                        <Td className="text-right tabular-nums">{p.reconciliation ? money(p.reconciliation.disbursedTotal) : "—"}</Td>
                        <Td className="text-right tabular-nums">{p.reconciliation ? money(p.reconciliation.compensatedTotal) : "—"}</Td>
                        <Td className={`text-right font-bold tabular-nums ${p.reconciliation && (p.reconciliation.differenceTotal || p.reconciliation.status === "WITH_DIFFERENCES") ? "text-danger" : ""}`}>{p.reconciliation ? money(p.reconciliation.differenceTotal) : "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Card className="flex flex-col gap-4 p-6">
                <CardHead title="Usuarios de la empresa" sub={`${c.users.length} usuario(s)`} />
                <ul className="flex flex-col divide-y divide-line-soft">
                  {c.users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-bold text-ink">{u.name}</span>
                        <span className="truncate text-[13px] font-medium text-ink-2">{u.email}</span>
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <Badge tone="teal">{roleLabel[u.role] ?? u.role}</Badge>
                        {!u.active && <Badge tone="gray">Inactivo</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="flex flex-col gap-4 p-6">
                <CardHead title="Sedes" sub={`${c.sites.length} sede(s)`} />
                {c.sites.length === 0 ? (
                  <p className="text-sm font-medium text-ink-2">Sin sedes registradas.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line-soft">
                    {c.sites.map((s) => (
                      <li key={s.id} className="flex justify-between py-3 text-[15px]">
                        <span className="font-bold text-ink">{s.name}</span>
                        <span className="font-medium text-ink-2">{s.city}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
