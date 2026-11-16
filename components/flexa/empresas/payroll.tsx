"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BadgeCheck, CalendarDays, CloudUpload, Copy, FileSpreadsheet, KeyRound, Plus, TriangleAlert, Users } from "@/components/flexa/empresas/icons";
import {
  Dialog,
  EmptyState,
  ErrorState,
  Facts,
  FilePick,
  FormField,
  IntegrationBadge,
  isoDay,
  Loading,
  noveltyTypes,
  Notice,
  PeriodBadge,
  ReadOnlyHint,
  SectionCard,
  Select,
  TextArea,
  TextInput,
  UploadBadge,
  useAction,
  useCanWrite,
  dateTime,
} from "@/components/flexa/empresas/kit";
import type { Novelty, Period, Upload, Worker } from "@/components/flexa/empresas/types";
import { CardHead, Kpi } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button, Card, IconBox } from "@/components/flexa/ui";
import { api, dateFmt, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Status = {
  period: { id: string; label: string; startDate: string; endDate: string; payDate: string } | null;
  integration?: { type: string; status: string; erpName: string | null; lastSyncAt: string | null };
  coveragePct?: number;
  missingWorkers?: { id: string; name: string; docNumber: string }[];
  openIssues?: number;
  lastUpload?: Upload | null;
  problems: string[];
  ready?: boolean;
};

const sourceLabel: Record<string, string> = { FILE: "Archivo", ERP_API: "ERP", MANUAL: "Manual" };

// ---------- Estado ----------

export function PayrollStatus({ onUpload }: { onUpload: () => void }) {
  const canWrite = useCanWrite();
  const { data: s, error, loading, reload } = useApi<Status>("/payroll/status");
  if (loading && !s) return <Loading rows={5} />;
  if (error || !s) return <ErrorState error={error} onRetry={reload} />;
  if (!s.period)
    return (
      <Card className="p-6">
        <EmptyState icon={CalendarDays} title="No hay un periodo abierto" text="Crea el periodo de nómina para empezar a recibir información." />
      </Card>
    );
  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={BadgeCheck} value={`${s.coveragePct}%`} label={`Cobertura de ${s.period.label}`} tone={s.coveragePct === 100 ? "green" : "amber"} />
        <Kpi icon={Users} value={s.missingWorkers?.length ?? 0} label="Habilitados sin información" tone={s.missingWorkers?.length ? "amber" : "teal"} />
        <Kpi icon={TriangleAlert} value={s.openIssues ?? 0} label="Inconsistencias sin resolver" tone={s.openIssues ? "red" : "green"} />
        <Kpi icon={CalendarDays} value={dateFmt(s.period.payDate, { day: "numeric", month: "short" })} label="Fecha de pago" tone="teal" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard>
          <CardHead title="Calidad de los datos" sub={s.ready ? "La nómina del periodo está lista para calcular anticipos." : "Hay puntos por revisar antes del pago."} />
          {s.problems.length ? (
            <ul className="flex flex-col gap-2">
              {s.problems.map((p) => (
                <li key={p} className="flex items-center gap-3 rounded-md bg-warning-soft/50 p-3 text-sm font-semibold text-ink">
                  <IconBox tone="amber" size="sm"><TriangleAlert /></IconBox>
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <Notice>Todo en orden: cobertura completa y sin inconsistencias.</Notice>
          )}
          {!!s.missingWorkers?.length && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-ink">Trabajadores sin información</h3>
              <ul className="flex max-h-64 flex-col divide-y divide-line-soft overflow-y-auto">
                {s.missingWorkers.map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/empresas/trabajadores/${w.id}`} className="font-bold text-ink hover:text-green-700">{w.name}</Link>
                    <span className="text-ink-2 tabular-nums">{w.docNumber}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <CardHead title="Fuente de información" action={s.integration && <IntegrationBadge value={s.integration.status} />} />
          <Facts
            items={[
              ["Integración", s.integration?.type === "ERP_API" ? `ERP ${s.integration.erpName ?? ""}` : "Carga de archivo"],
              ["Última sincronización", dateTime(s.integration?.lastSyncAt)],
              ["Última carga", s.lastUpload ? s.lastUpload.fileName : "—"],
              ["Resultado", s.lastUpload ? `${s.lastUpload.okRows} de ${s.lastUpload.totalRows} filas` : "—"],
            ]}
          />
          {s.lastUpload && (
            <Link href={`/empresas/nomina/cargas/${s.lastUpload.id}`} className="text-[13px] font-bold text-green-700 hover:underline">Ver detalle de la última carga</Link>
          )}
          {canWrite && <Button size="md" className="mt-auto" onClick={onUpload}><CloudUpload />Cargar nómina del periodo</Button>}
        </SectionCard>
      </div>
    </>
  );
}

// ---------- Carga de CSV ----------

export function PayrollUploadDialog({ open, onClose, periods, defaultPeriod }: { open: boolean; onClose: () => void; periods: Period[]; defaultPeriod?: string }) {
  const router = useRouter();
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const [periodId, setPeriodId] = useState(defaultPeriod ?? "");
  const [file, setFile] = useState<File | null>(null);
  const { busy, error, run } = useAction();
  const chosen = periodId || openPeriods[0]?.id || "";
  return (
    <Dialog
      open={open}
      onClose={() => (setFile(null), onClose())}
      wide
      title="Cargar nómina"
      sub="Validamos cada fila: las válidas se aplican y las demás quedan como inconsistencias."
      onSubmit={async () => {
        if (!file || !chosen) return;
        const form = new FormData();
        form.append("file", file);
        const up = await run(() => api<{ id?: string; upload?: { id: string } }>(`/payroll/periods/${chosen}/upload`, { form }));
        const id = up?.upload?.id ?? up?.id;
        if (up) {
          setFile(null);
          onClose();
          if (id) router.push(`/empresas/nomina/cargas/${id}`);
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={!file || !chosen || busy}>{busy ? "Validando…" : "Cargar y validar"}</Button>
        </>
      }
    >
      {openPeriods.length ? (
        <>
          <FormField label="Periodo">
            <Select value={chosen} onChange={(e) => setPeriodId(e.target.value)} options={openPeriods.map((p) => ({ value: p.id, label: p.label }))} />
          </FormField>
          <FilePick file={file} onFile={setFile} hint="documento, salario, dias_trabajados, horas_extra, valor_horas_extra, recargos, deducciones" />
        </>
      ) : (
        <Notice tone="amber">No hay periodos abiertos. Crea uno en la pestaña Periodos.</Notice>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

// ---------- Periodos ----------

export function PeriodsTab({ periods, reload }: { periods: Period[]; reload: () => void }) {
  const canWrite = useCanWrite();
  const [create, setCreate] = useState(false);
  return (
    <SectionCard>
      <CardHead title="Periodos de nómina" sub="Fechas, presupuesto y estado de cada periodo" action={canWrite && <Button size="sm" onClick={() => setCreate(true)}><Plus />Nuevo periodo</Button>} />
      {periods.length ? (
        <Table>
          <thead>
            <tr><Th>Periodo</Th><Th>Fechas</Th><Th>Pago</Th><Th className="text-right">Presupuesto</Th><Th className="text-right">Registros</Th><Th className="text-right">Anticipos</Th><Th>Estado</Th></tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-mint-1">
                <Td><Link href={`/empresas/nomina/periodos/${p.id}`} className="font-bold text-green-700 hover:underline">{p.label}</Link></Td>
                <Td className="text-ink-2">{dateFmt(p.startDate, { day: "numeric", month: "short" })} – {dateFmt(p.endDate, { day: "numeric", month: "short" })}</Td>
                <Td className="text-ink-2">{dateFmt(p.payDate)}</Td>
                <Td className="text-right tabular-nums">{p.budget ? money(p.budget) : <span className="text-ink-3">Sin definir</span>}</Td>
                <Td className="text-right tabular-nums">{p._count?.entries ?? 0}</Td>
                <Td className="text-right tabular-nums">{p._count?.advances ?? 0}</Td>
                <Td><PeriodBadge value={p.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={CalendarDays} title="Aún no hay periodos" text="Crea el primer periodo para empezar a cargar nómina." />
      )}
      <PeriodDialog open={create} onClose={() => setCreate(false)} onDone={reload} />
    </SectionCard>
  );
}

function PeriodDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  async function submit(e: FormEvent<HTMLFormElement>) {
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const ok = await run(() => api("/payroll/periods", { body: { label: f.label, startDate: f.startDate, endDate: f.endDate, payDate: f.payDate, budget: f.budget ? Number(f.budget.replace(/\D/g, "")) : undefined } }));
    if (ok) {
      onDone();
      onClose();
    }
  }
  const label = start.toLocaleDateString("es-CO", { month: "short", year: "numeric" }).replace(".", "").replace(/^./, (c) => c.toUpperCase()).replace(" de ", " ");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo periodo"
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Creando…" : "Crear periodo"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre" className="col-span-2"><TextInput name="label" required defaultValue={label} /></FormField>
        <FormField label="Inicio"><TextInput name="startDate" type="date" required defaultValue={isoDay(start)} /></FormField>
        <FormField label="Fin"><TextInput name="endDate" type="date" required defaultValue={isoDay(end)} /></FormField>
        <FormField label="Fecha de pago"><TextInput name="payDate" type="date" required defaultValue={isoDay(end)} /></FormField>
        <FormField label="Presupuesto (opcional)"><TextInput name="budget" inputMode="numeric" placeholder="117000000" /></FormField>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

// ---------- Cargas ----------

export function UploadsTab() {
  const { data, error, loading, reload } = useApi<Upload[]>("/payroll/uploads");
  return (
    <SectionCard>
      <CardHead title="Historial de cargas" sub="Archivos y sincronizaciones del ERP" />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading rows={5} />
      ) : !data?.length ? (
        <EmptyState icon={FileSpreadsheet} title="Aún no hay cargas" text="Carga un archivo o conecta tu ERP para empezar." />
      ) : (
        <Table>
          <thead>
            <tr><Th>Archivo</Th><Th>Periodo</Th><Th>Origen</Th><Th>Fecha</Th><Th className="text-right">Filas válidas</Th><Th className="text-right">Pendientes</Th><Th>Estado</Th></tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-mint-1">
                <Td><Link href={`/empresas/nomina/cargas/${u.id}`} className="font-bold text-green-700 hover:underline">{u.fileName}</Link></Td>
                <Td className="text-ink-2">{u.period.label}</Td>
                <Td className="text-ink-2">{sourceLabel[u.source] ?? u.source}</Td>
                <Td className="text-ink-2">{dateTime(u.createdAt)}</Td>
                <Td className="text-right tabular-nums">{u.okRows} / {u.totalRows}</Td>
                <Td className={cn("text-right tabular-nums", u._count?.issues ? "font-bold text-warning" : "text-ink-2")}>{u._count?.issues ?? 0}</Td>
                <Td><UploadBadge value={u.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SectionCard>
  );
}

// ---------- Novedades ----------

export function NoveltiesTab({ periods }: { periods: Period[] }) {
  const canWrite = useCanWrite();
  const [periodId, setPeriodId] = useState("");
  const { data, error, loading, reload } = useApi<Novelty[]>(`/payroll/novelties${periodId ? `?periodId=${periodId}` : ""}`);
  const [create, setCreate] = useState(false);
  return (
    <SectionCard>
      <CardHead
        title="Novedades de nómina"
        sub="Incapacidades, vacaciones, ausencias y ajustes que afectan el devengado"
        action={
          <div className="flex items-center gap-3">
            <Select aria-label="Periodo" value={periodId} onChange={(e) => setPeriodId(e.target.value)} options={periods.map((p) => ({ value: p.id, label: p.label }))} placeholder="Todos los periodos" className="w-48" />
            {canWrite && <Button size="sm" onClick={() => setCreate(true)}><Plus />Registrar novedad</Button>}
          </div>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading rows={5} />
      ) : !data?.length ? (
        <EmptyState title="Sin novedades" text="No hay novedades registradas para este filtro." />
      ) : (
        <Table>
          <thead>
            <tr><Th>Trabajador</Th><Th>Tipo</Th><Th>Descripción</Th><Th>Fecha</Th><Th className="text-right">Días</Th><Th className="text-right">Valor</Th><Th>Periodo</Th></tr>
          </thead>
          <tbody>
            {data.map((n) => (
              <tr key={n.id}>
                <Td className="font-bold">{n.worker.firstName} {n.worker.lastName}</Td>
                <Td>{noveltyTypes[n.type] ?? n.type}</Td>
                <Td className="max-w-72 truncate text-ink-2">{n.description}</Td>
                <Td className="text-ink-2">{dateFmt(n.date)}</Td>
                <Td className="text-right tabular-nums">{n.days || "—"}</Td>
                <Td className="text-right tabular-nums">{n.amount ? money(n.amount) : "—"}</Td>
                <Td className="text-ink-2">{n.period?.label ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <NoveltyDialog open={create} onClose={() => setCreate(false)} onDone={reload} periods={periods} />
    </SectionCard>
  );
}

function NoveltyDialog({ open, onClose, onDone, periods }: { open: boolean; onClose: () => void; onDone: () => void; periods: Period[] }) {
  const workers = useApi<Worker[]>(open ? "/company/workers" : null);
  const { busy, error, run } = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const ok = await run(() =>
      api("/payroll/novelties", {
        body: {
          workerId: f.workerId,
          periodId: f.periodId || undefined,
          type: f.type,
          description: f.description,
          days: f.days ? Number(f.days) : undefined,
          amount: f.amount ? Number(f.amount.replace(/\D/g, "")) : undefined,
          date: f.date || undefined,
        },
      }),
    );
    if (ok) {
      onDone();
      onClose();
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Registrar novedad"
      sub="Las novedades no remuneradas descuentan días del devengado."
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Registrar"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Trabajador" className="col-span-2">
          <Select name="workerId" required options={(workers.data ?? []).map((w) => ({ value: w.id, label: `${w.name} · ${w.docNumber}` }))} placeholder={workers.loading ? "Cargando…" : "Elige un trabajador"} />
        </FormField>
        <FormField label="Tipo"><Select name="type" required options={Object.entries(noveltyTypes).map(([value, label]) => ({ value, label }))} /></FormField>
        <FormField label="Periodo"><Select name="periodId" options={periods.filter((p) => p.status === "OPEN").map((p) => ({ value: p.id, label: p.label }))} placeholder="Periodo abierto" /></FormField>
        <FormField label="Fecha"><TextInput name="date" type="date" defaultValue={isoDay(new Date())} /></FormField>
        <FormField label="Días"><TextInput name="days" type="number" min={0} max={31} /></FormField>
        <FormField label="Valor (si aplica)"><TextInput name="amount" inputMode="numeric" /></FormField>
        <FormField label="Descripción" className="col-span-2"><TextArea name="description" required minLength={3} /></FormField>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

// ---------- Integración ----------

export function IntegrationTab() {
  const canWrite = useCanWrite();
  const company = useApi<{ integrationType: string; integrationStatus: string; erpName: string | null; lastSyncAt: string | null; hasApiKey: boolean }>("/company");
  const [erp, setErp] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction();
  const c = company.data;
  if (company.error) return <ErrorState error={company.error} onRetry={company.reload} />;
  if (!c) return <Loading rows={4} />;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <SectionCard>
        <CardHead title="Integración con el ERP" action={<IntegrationBadge value={c.integrationStatus} />} />
        <Facts
          items={[
            ["Tipo", c.integrationType === "ERP_API" ? "API del ERP" : "Carga de archivo"],
            ["ERP", c.erpName ?? "—"],
            ["Última sincronización", dateTime(c.lastSyncAt)],
            ["API key", c.hasApiKey ? "Configurada" : "Sin generar"],
          ]}
        />
        <p className="text-[13px] font-medium text-ink-2">
          Tu ERP envía la nómina a <code className="rounded bg-head px-1.5 py-0.5 text-ink">POST /api/payroll/erp/sync</code> con el encabezado <code className="rounded bg-head px-1.5 py-0.5 text-ink">x-api-key</code>.
        </p>
      </SectionCard>
      <SectionCard>
        <CardHead title={c.hasApiKey ? "Rotar API key" : "Generar API key"} sub="La clave anterior deja de funcionar al generar una nueva." />
        {key ? (
          <div className="flex flex-col gap-3">
            <Notice tone="amber">Guárdala ahora: no se volverá a mostrar.</Notice>
            <div className="flex items-center gap-2 rounded-md bg-head p-3">
              <code className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{key}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(key);
                  setCopied(true);
                }}
              >
                <Copy />
                {copied ? "Copiada" : "Copiar"}
              </Button>
            </div>
          </div>
        ) : canWrite ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await run(() => api<{ apiKey: string }>("/payroll/integration/api-key", { body: { erpName: erp || c.erpName || undefined } }));
              if (r) {
                setKey(r.apiKey);
                setCopied(false);
                company.reload();
              }
            }}
          >
            <FormField label="Nombre del ERP"><TextInput value={erp} onChange={(e) => setErp(e.target.value)} placeholder={c.erpName ?? "SIESA, SAP, World Office…"} /></FormField>
            {error && <Notice tone="red">{error}</Notice>}
            <Button type="submit" size="md" disabled={busy}><KeyRound />{busy ? "Generando…" : c.hasApiKey ? "Generar nueva clave" : "Generar clave"}</Button>
          </form>
        ) : (
          <ReadOnlyHint />
        )}
      </SectionCard>
    </div>
  );
}
