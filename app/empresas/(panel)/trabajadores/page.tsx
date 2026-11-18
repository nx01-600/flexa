"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudUpload, Plus, TriangleAlert, UserCheck, UserX, Users } from "@/components/flexa/icons";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { WorkerBulkUpload } from "@/components/flexa/empresas/worker-forms";
import { ConfirmDialog, EmptyState, ErrorState, Loading, Notice, SearchBox, Select, useCanWrite, WorkerBadge, workerStatus } from "@/components/flexa/empresas/kit";
import type { Settings, Site, Worker } from "@/components/flexa/empresas/types";
import { Avatar, Kpi } from "@/components/flexa/empresas-ui";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button, ButtonLink, Card } from "@/components/flexa/ui";
import { api, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const access = [
  { value: "", label: "Todos" },
  { value: "true", label: "Habilitados" },
  { value: "false", label: "Sin acceso" },
] as const;

const PAGE = 15;

export default function Workers() {
  const canWrite = useCanWrite();
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim());
  const [enabled, setEnabled] = useState<(typeof access)[number]["value"]>("");
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | boolean>(null);
  const [upload, setUpload] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const params = new URLSearchParams(Object.entries({ q: dq, enabled, siteId, status }).filter(([, v]) => v));
  const workers = useApi<Worker[]>(`/company/workers?${params}`);
  const all = useApi<Worker[]>("/company/workers");
  const sites = useApi<Site[]>("/company/sites");
  const settings = useApi<Settings>("/company/settings");

  const list = useMemo(() => workers.data ?? [], [workers.data]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = list.slice(current * PAGE, current * PAGE + PAGE);

  const totals = all.data ?? [];
  const highUse = (w: Worker) => {
    const cap = settings.data ? (w.baseSalary * settings.data.maxAdvancePct) / 100 : 0;
    return cap ? Math.round((w.withdrawnPeriod / cap) * 100) : 0;
  };
  const alarm = settings.data?.alarmUsagePct ?? 70;

  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const refresh = () => {
    workers.reload();
    all.reload();
  };

  return (
    <>
      <PageHeader
        title="Trabajadores"
        sub="Personas de tu nómina, su acceso a Flexa y su uso en el periodo."
        action={
          canWrite && (
            <>
              <Button variant="outline" size="md" onClick={() => setUpload(true)}><CloudUpload className="text-green-700" />Cargar CSV</Button>
              <ButtonLink href="/empresas/trabajadores/nuevo" size="md"><Plus />Registrar trabajador</ButtonLink>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} value={all.data ? totals.filter((w) => w.status !== "RETIRED").length : "—"} label="Trabajadores en nómina" />
        <Kpi icon={UserCheck} value={all.data ? totals.filter((w) => w.enabled).length : "—"} label="Habilitados en Flexa" tone="teal" />
        <Kpi icon={UserX} value={all.data ? totals.filter((w) => !w.enabled && w.status !== "RETIRED").length : "—"} label="Sin acceso" tone="green" />
        <Kpi icon={TriangleAlert} value={all.data && settings.data ? totals.filter((w) => w.enabled && highUse(w) >= alarm).length : "—"} label={`Con uso del tope ≥ ${alarm}%`} tone="amber" />
      </div>

      {msg && <Notice onClose={() => setMsg(null)}>{msg}</Notice>}

      <Card className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={(v) => (setQ(v), setPage(0))} placeholder="Buscar por nombre, cédula o correo" />
          <Select aria-label="Sede" value={siteId} onChange={(e) => (setSiteId(e.target.value), setPage(0))} options={(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))} placeholder="Todas las sedes" className="w-full sm:w-52" />
          <Select aria-label="Estado" value={status} onChange={(e) => (setStatus(e.target.value), setPage(0))} options={Object.entries(workerStatus).map(([value, [label]]) => ({ value, label }))} placeholder="Todos los estados" className="w-full sm:w-52" />
          <PillTabs options={access} value={enabled} onChange={(v) => (setEnabled(v), setPage(0))} className="[&>button]:h-11 [&>button]:px-5 max-sm:[&>button]:px-4" />
        </div>

        {canWrite && selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-green-100 px-4 py-2.5 max-sm:flex-wrap">
            <span className="flex-1 text-sm font-bold text-green-900 tabular-nums max-sm:basis-full">{selected.size} seleccionados</span>
            <Button variant="soft" size="sm" className="bg-white" onClick={() => setBulk(true)}>Habilitar</Button>
            <Button variant="danger-outline" size="sm" onClick={() => setBulk(false)}>Deshabilitar</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpiar</Button>
          </div>
        )}

        {workers.error ? (
          <ErrorState error={workers.error} onRetry={workers.reload} />
        ) : workers.loading && !workers.data ? (
          <Loading rows={6} />
        ) : (
          <Table className={cn(workers.loading && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                {canWrite && (
                  <Th className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar página"
                      checked={allOnPage}
                      onChange={() => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; })}
                      className="size-4 accent-green-600"
                    />
                  </Th>
                )}
                <Th>Nombre</Th><Th>Cédula</Th><Th>Sede</Th><Th>Estado</Th><Th className="text-right">Salario</Th><Th className="text-right">Retirado</Th><Th>Uso del tope</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const use = highUse(w);
                const high = use >= alarm;
                return (
                  <tr key={w.id} className="transition-colors hover:bg-mint-1">
                    {canWrite && (
                      <Td><input type="checkbox" aria-label={`Seleccionar a ${w.name}`} checked={selected.has(w.id)} onChange={() => toggleOne(w.id)} className="size-4 accent-green-600" /></Td>
                    )}
                    <Td>
                      <Link href={`/empresas/trabajadores/${w.id}`} className="flex items-center gap-3 rounded-sm hover:text-green-700">
                        <Avatar name={w.name} />
                        <span className="flex flex-col">
                          <span className="font-bold">{w.name}</span>
                          <span className="text-xs font-medium text-ink-3">{w.position ?? "Sin cargo"}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="text-ink-2 tabular-nums">{w.docNumber}</Td>
                    <Td className="text-ink-2">{w.site?.name ?? "—"}</Td>
                    <Td><WorkerBadge value={w.status} /></Td>
                    <Td className="text-right text-ink-2 tabular-nums">{money(w.baseSalary)}</Td>
                    <Td className="text-right font-bold tabular-nums">{w.enabled ? money(w.withdrawnPeriod) : "—"}</Td>
                    <Td>
                      {w.enabled ? (
                        <span className="flex items-center gap-3">
                          <span className="h-2 w-24 rounded-full bg-green-100">
                            <span className={cn("block h-full rounded-full", high ? "bg-linear-to-r from-[#f2c14e] to-warning-icon" : "bg-linear-to-r from-green-300 to-green-500")} style={{ width: `${Math.min(use, 100)}%` }} />
                          </span>
                          <span className={cn("w-10 text-[13px] font-bold tabular-nums", high ? "text-warning" : "text-ink-2")}>{use}%</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <Td colSpan={canWrite ? 8 : 7}>
                    <EmptyState icon={Users} title="No hay trabajadores que coincidan" text="Prueba con otra búsqueda o quita los filtros." />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        )}

        <div className="flex items-center justify-between pt-1 max-sm:flex-wrap max-sm:gap-y-3">
          <span className="text-sm font-semibold text-ink-2 tabular-nums">
            {list.length ? `Mostrando ${current * PAGE + 1}–${Math.min((current + 1) * PAGE, list.length)} de ${list.length}` : "Sin resultados"}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm transition-colors hover:text-green-700 disabled:text-ink-3 disabled:opacity-60 [&_svg]:size-[18px]">
                <ChevronLeft />
              </button>
              <span className="px-2 text-sm font-bold text-ink-2 tabular-nums">{current + 1} / {pages}</span>
              <button type="button" aria-label="Página siguiente" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm transition-colors hover:text-green-700 disabled:text-ink-3 disabled:opacity-60 [&_svg]:size-[18px]">
                <ChevronRight />
              </button>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        title={bulk ? "Habilitar trabajadores" : "Deshabilitar trabajadores"}
        text={bulk ? `${selected.size} trabajadores podrán usar Flexa. Los retirados no se habilitan.` : `${selected.size} trabajadores dejarán de poder solicitar anticipos.`}
        confirm={bulk ? "Habilitar" : "Deshabilitar"}
        danger={bulk === false}
        note={bulk ? undefined : { label: "Motivo", placeholder: "Ej. Fin de contrato, revisión interna…" }}
        onConfirm={async (reason) => {
          // The API takes at most 500 ids per call.
          const ids = [...selected];
          let updated = 0;
          for (let i = 0; i < ids.length; i += 500) {
            const r = await api<{ updated: number }>("/company/workers/access", { body: { ids: ids.slice(i, i + 500), enabled: bulk, reason: reason || undefined } });
            updated += r.updated;
          }
          setMsg(`${updated} trabajadores ${bulk ? "habilitados" : "deshabilitados"}.`);
          setSelected(new Set());
          refresh();
        }}
      />

      <WorkerBulkUpload open={upload} onClose={() => setUpload(false)} onDone={refresh} />
    </>
  );
}
