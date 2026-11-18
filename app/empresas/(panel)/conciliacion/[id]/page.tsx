"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, CheckSquare, CloudUpload, Download, Lock } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { ConfirmDialog, Dialog, EmptyState, ErrorState, Facts, FilePick, FormField, LineBadge, Notice, PageLoading, PeriodBadge, ReadOnlyHint, ReconBadge, SearchBox, SectionCard, TextArea, TextInput, useAction, useCanWrite } from "@/components/flexa/empresas/kit";
import type { CompLine, Period, Reconciliation } from "@/components/flexa/empresas/types";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button } from "@/components/flexa/ui";
import { api, download, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Detail = {
  period: Period;
  reconciliation: Reconciliation | null;
  // difference is net; absoluteDifference sums per-line gaps, is what the backend checks to reconcile, and is what the page shows.
  totals: { workers: number; toCompensate: number; compensated: number; difference: number; absoluteDifference: number; withDifferences: number };
  lines: CompLine[];
};

export default function CompensationPeriod() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCanWrite();
  const { data: d, error, loading, reload } = useApi<Detail>(`/compensation/periods/${id}`);
  const [q, setQ] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [dialog, setDialog] = useState<"close" | "applied" | "all" | "reconcile" | null>(null);
  const [fix, setFix] = useState<CompLine | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "amber"; text: string } | null>(null);
  const dl = useAction();

  if (loading && !d) return <PageLoading />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  const { period: p, totals: t, reconciliation: r } = d;
  const open = p.status === "OPEN";
  const reconciled = p.status === "RECONCILED";
  const slug = p.label.toLowerCase().replace(/\s+/g, "-");
  const term = q.trim().toLowerCase();
  const lines = d.lines.filter(
    (l) => (!onlyDiff || l.difference !== 0) && (!term || `${l.worker.firstName} ${l.worker.lastName} ${l.worker.docNumber}`.toLowerCase().includes(term)),
  );
  const done = (text: string, tone: "green" | "amber" = "green") => {
    setMsg({ tone, text });
    reload();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/empresas/conciliacion", label: "Conciliación" }}
        title={`Compensación ${p.label}`}
        sub={open ? "El periodo sigue abierto. Ciérralo para consolidar lo anticipado por trabajador." : "Aplica los descuentos en tu nómina, repórtalos y concilia."}
        action={
          <>
            <PeriodBadge value={p.status} />
            {r && <ReconBadge value={r.status} />}
          </>
        }
      />
      {msg && <Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      {dl.error && <Notice tone="red" onClose={() => dl.setError(null)}>{dl.error}</Notice>}

      <SectionCard>
        <Facts
          cols={4}
          items={[
            ["Trabajadores", t.workers],
            ["A compensar", money(t.toCompensate)],
            ["Descontado en nómina", money(t.compensated)],
            ["Diferencia", <span key="d" className={cn(t.absoluteDifference ? "text-warning" : "text-green-700")}>{money(t.absoluteDifference)}</span>],
          ]}
        />
      </SectionCard>

      {/* Steps: close, export, report, reconcile */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-4">
        <Step n={1} title="Cerrar el periodo" text="Consolida lo anticipado por trabajador." done={!open}>
          {open && canWrite && <Button size="sm" onClick={() => setDialog("close")}><Lock />Cerrar periodo</Button>}
        </Step>
        <Step n={2} title="Exportar descuentos" text="Archivo para cargar en tu sistema de nómina." done={false} disabled={open}>
          {!open && (
            <Button variant="outline" size="sm" disabled={dl.busy} onClick={() => dl.run(() => download(`/compensation/periods/${p.id}/export`, `descuentos-flexa-${slug}.csv`))}>
              <Download className="text-green-700" />Exportar CSV
            </Button>
          )}
        </Step>
        <Step n={3} title="Reportar lo descontado" text="Indica lo que realmente se aplicó en el pago." done={t.compensated > 0} disabled={open}>
          {!open && !reconciled && canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog("applied")}><CloudUpload className="text-green-700" />Cargar CSV</Button>
              <Button variant="soft" size="sm" onClick={() => setDialog("all")}><CheckSquare />Todo aplicado</Button>
            </div>
          )}
        </Step>
        <Step n={4} title="Conciliar" text={t.absoluteDifference ? "Resuelve las diferencias o cierra con una nota." : "Sin diferencias: listo para cerrar."} done={reconciled} disabled={open}>
          {!open && !reconciled && canWrite && <Button size="sm" onClick={() => setDialog("reconcile")}><BadgeCheck />Conciliar</Button>}
        </Step>
      </div>
      {!canWrite && <ReadOnlyHint />}

      <SectionCard>
        <CardHead
          title="Líneas por trabajador"
          sub={t.withDifferences ? `${t.withDifferences} con diferencias` : "Lo anticipado y lo descontado a cada persona"}
          action={
            !open && (
              <Button variant="ghost" size="sm" disabled={dl.busy} onClick={() => dl.run(() => download(`/compensation/periods/${p.id}/report`, `conciliacion-flexa-${slug}.csv`))}>
                <Download />Reporte de conciliación
              </Button>
            )
          }
        />
        <div className="flex flex-wrap items-center gap-4">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o cédula" className="max-w-md" />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="size-4 accent-green-600" />
            Solo con diferencias
          </label>
        </div>
        {lines.length ? (
          <Table>
            <thead>
              <tr><Th>Trabajador</Th><Th>Sede</Th><Th className="text-right">Anticipos</Th><Th className="text-right">A compensar</Th><Th className="text-right">Descontado</Th><Th className="text-right">Diferencia</Th><Th>Estado</Th>{canWrite && !reconciled && <Th className="relative w-28"><span className="sr-only">Acciones</span></Th>}</tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-mint-1">
                  <Td>
                    <Link href={`/empresas/trabajadores/${l.workerId}`} className="flex flex-col hover:text-green-700">
                      <span className="font-bold">{l.worker.firstName} {l.worker.lastName}</span>
                      <span className="text-xs text-ink-3 tabular-nums">{l.worker.docNumber}{l.note ? ` · ${l.note}` : ""}</span>
                    </Link>
                  </Td>
                  <Td className="text-ink-2">{l.worker.site?.name ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{l.advancesCount}</Td>
                  <Td className="text-right tabular-nums">{money(l.toCompensate)}</Td>
                  <Td className="text-right tabular-nums">{money(l.compensatedAmount)}</Td>
                  <Td className={cn("text-right tabular-nums", l.difference ? "font-bold text-warning" : "text-ink-2")}>{money(l.difference)}</Td>
                  <Td><LineBadge value={l.status} /></Td>
                  {canWrite && !reconciled && <Td className="text-right">{!open && <Button variant="ghost" size="sm" onClick={() => setFix(l)}>Ajustar</Button>}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={d.lines.length ? "Sin coincidencias" : open ? "Aún no hay líneas" : "Sin anticipos en el periodo"} text={open && !d.lines.length ? "Las líneas se crean al cerrar el periodo." : undefined} />
        )}
      </SectionCard>

      <ConfirmDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        title={`Cerrar ${p.label}`}
        text="Se consolidan los anticipos desembolsados por trabajador y el periodo deja de recibir solicitudes y cargas de nómina. Esta acción no se puede deshacer."
        confirm="Cerrar periodo"
        danger
        onConfirm={async () => {
          await api(`/compensation/periods/${p.id}/close`, { method: "POST" });
          done("Periodo cerrado. Exporta el archivo de descuentos para tu nómina.");
        }}
      />
      <ConfirmDialog
        open={dialog === "all"}
        onClose={() => setDialog(null)}
        title="Reportar todo como aplicado"
        text={`Se registrará que se descontaron ${money(t.toCompensate)} completos a los ${t.workers} trabajadores. Úsalo solo si aplicaste el archivo sin cambios.`}
        confirm="Reportar"
        onConfirm={async () => {
          const r = await api<{ unknownDocuments: string[] }>(`/compensation/periods/${p.id}/applied`, { body: { items: d.lines.map((l) => ({ docNumber: l.worker.docNumber, amount: l.toCompensate })) } });
          done(r.unknownDocuments.length ? `Reportado. Documentos no encontrados: ${r.unknownDocuments.join(", ")}` : "Descuentos reportados.", r.unknownDocuments.length ? "amber" : "green");
        }}
      />
      <AppliedUpload open={dialog === "applied"} onClose={() => setDialog(null)} periodId={p.id} onDone={done} />
      <ReconcileDialog open={dialog === "reconcile"} onClose={() => setDialog(null)} periodId={p.id} difference={t.absoluteDifference} onDone={() => done("Periodo conciliado.")} />
      <FixDialog line={fix} onClose={() => setFix(null)} onDone={() => done("Línea ajustada.")} />
    </>
  );
}

function Step({ n, title, text, done, disabled, children }: { n: number; title: string; text: string; done: boolean; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card", disabled && "opacity-55")}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold", done ? "bg-btn-primary text-white shadow-btn" : "bg-green-100 text-green-800")}>{n}</span>
        <span className="text-[15px] font-bold text-ink">{title}</span>
      </div>
      <p className="text-[13px] font-medium text-ink-2">{text}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function AppliedUpload({ open, onClose, periodId, onDone }: { open: boolean; onClose: () => void; periodId: string; onDone: (t: string, tone?: "green" | "amber") => void }) {
  const [file, setFile] = useState<File | null>(null);
  const { busy, error, run } = useAction();
  return (
    <Dialog
      open={open}
      onClose={() => (setFile(null), onClose())}
      title="Cargar descuentos aplicados"
      sub="Columnas: documento, valor_descontado. Los documentos que no envíes quedan pendientes."
      onSubmit={async () => {
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        const r = await run(() => api<{ unknownDocuments: string[] }>(`/compensation/periods/${periodId}/applied`, { form }));
        if (r) {
          setFile(null);
          onClose();
          onDone(r.unknownDocuments.length ? `Reportado. Documentos no encontrados: ${r.unknownDocuments.join(", ")}` : "Descuentos reportados.", r.unknownDocuments.length ? "amber" : "green");
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={!file || busy}>{busy ? "Procesando…" : "Cargar"}</Button>
        </>
      }
    >
      <FilePick file={file} onFile={setFile} hint="documento, valor_descontado" />
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

function ReconcileDialog({ open, onClose, periodId, difference, onDone }: { open: boolean; onClose: () => void; periodId: string; difference: number; onDone: () => void }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();
  const force = difference !== 0;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Conciliar periodo"
      onSubmit={async () => {
        const ok = await run(() => api(`/compensation/periods/${periodId}/reconcile`, { body: force ? { force: true, note: note.trim() } : {} }));
        if (ok) {
          setNote("");
          onClose();
          onDone();
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={force ? "danger" : "primary"} size="sm" disabled={busy || (force && note.trim().length < 5)}>{busy ? "Conciliando…" : force ? "Conciliar con diferencias" : "Conciliar"}</Button>
        </>
      }
    >
      {force ? (
        <>
          <Notice tone="amber">Quedan {money(difference)} de diferencia. Puedes ajustar las líneas o cerrar con una nota que quedará en la trazabilidad.</Notice>
          <FormField label="Motivo del cierre con diferencias">
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Se descontará en el siguiente periodo por retiro del trabajador" required />
          </FormField>
        </>
      ) : (
        <p className="text-[15px] font-medium text-ink-2">Lo anticipado coincide con lo descontado. El periodo quedará conciliado y cerrado.</p>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

function FixDialog({ line, onClose, onDone }: { line: CompLine | null; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <Dialog
      open={!!line}
      onClose={onClose}
      title="Ajustar línea"
      sub={line ? `${line.worker.firstName} ${line.worker.lastName} · a compensar ${money(line.toCompensate)}` : undefined}
      onSubmit={async (e) => {
        if (!line) return;
        const f = new FormData(e.currentTarget);
        const ok = await run(() =>
          api(`/compensation/lines/${line.id}`, { method: "PATCH", body: { compensatedAmount: Number(String(f.get("amount")).replace(/\D/g, "")), note: String(f.get("note")).trim() } }),
        );
        if (ok) {
          onClose();
          onDone();
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Guardar ajuste"}</Button>
        </>
      }
    >
      {line && (
        <div key={line.id} className="flex flex-col gap-4">
          <FormField label="Valor descontado en nómina"><TextInput name="amount" inputMode="numeric" required pattern="[0-9.]+" defaultValue={line.compensatedAmount} /></FormField>
          <FormField label="Nota"><TextArea name="note" required minLength={3} defaultValue={line.note ?? ""} placeholder="Qué pasó con esta diferencia" /></FormField>
        </div>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}
