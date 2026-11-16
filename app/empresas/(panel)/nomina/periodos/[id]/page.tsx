"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CloudUpload, PencilIcon } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { Dialog, EmptyState, ErrorState, Facts, FormField, Notice, PageLoading, PeriodBadge, SearchBox, SectionCard, TextInput, useAction, useCanWrite } from "@/components/flexa/empresas/kit";
import { PayrollUploadDialog } from "@/components/flexa/empresas/payroll";
import type { Period } from "@/components/flexa/empresas/types";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button } from "@/components/flexa/ui";
import { api, dateFmt, money, useApi } from "@/lib/api";

type Entry = {
  id: string;
  workerId: string;
  baseSalary: number;
  workedDays: number;
  overtimeHours: number;
  overtimeAmount: number;
  surcharges: number;
  deductions: number;
  worker: { firstName: string; lastName: string; docNumber: string };
};
type Detail = Period & { entries: Entry[] };

export default function PeriodDetail() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCanWrite();
  const { data: p, error, loading, reload } = useApi<Detail>(`/payroll/periods/${id}`);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Entry | null>(null);
  const [budget, setBudget] = useState(false);
  const [upload, setUpload] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading && !p) return <PageLoading />;
  if (error || !p) return <ErrorState error={error} onRetry={reload} />;
  const open = p.status === "OPEN";
  const term = q.trim().toLowerCase();
  const entries = p.entries
    .filter((e) => !term || `${e.worker.firstName} ${e.worker.lastName} ${e.worker.docNumber}`.toLowerCase().includes(term))
    .sort((a, b) => a.worker.lastName.localeCompare(b.worker.lastName));
  const sum = (k: keyof Entry) => p.entries.reduce((a, e) => a + Number(e[k]), 0);

  return (
    <>
      <PageHeader
        back={{ href: "/empresas/nomina?tab=periodos", label: "Periodos" }}
        title={`Nómina ${p.label}`}
        sub={`${dateFmt(p.startDate)} – ${dateFmt(p.endDate)} · pago el ${dateFmt(p.payDate)}`}
        action={
          <>
            <PeriodBadge value={p.status} />
            {canWrite && open && <Button size="md" onClick={() => setUpload(true)}><CloudUpload />Cargar archivo</Button>}
            {p.status !== "OPEN" && <Link href={`/empresas/conciliacion/${p.id}`} className="text-sm font-bold text-green-700 hover:underline">Ver conciliación</Link>}
          </>
        }
      />
      {msg && <Notice onClose={() => setMsg(null)}>{msg}</Notice>}
      <SectionCard>
        <CardHead title="Totales del periodo" action={<Button variant="outline" size="sm" onClick={() => setBudget(true)}><PencilIcon className="text-green-700" />Presupuesto</Button>} />
        <Facts
          cols={4}
          items={[
            ["Presupuesto", p.budget ? money(p.budget) : "Sin definir"],
            ["Salarios base", money(sum("baseSalary"))],
            ["Horas extra", `${money(sum("overtimeAmount"))} · ${sum("overtimeHours")} h`],
            ["Recargos / deducciones", `${money(sum("surcharges"))} / ${money(sum("deductions"))}`],
          ]}
        />
      </SectionCard>

      <SectionCard>
        <CardHead title="Registros por trabajador" sub={open ? "Corrige un registro si la carga trajo un dato errado. El cambio queda auditado." : "El periodo está cerrado; los registros ya no se pueden corregir."} />
        <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o cédula" className="max-w-md" />
        {entries.length ? (
          <Table>
            <thead>
              <tr><Th>Trabajador</Th><Th className="text-right">Salario</Th><Th className="text-right">Días</Th><Th className="text-right">Horas extra</Th><Th className="text-right">Valor h. extra</Th><Th className="text-right">Recargos</Th><Th className="text-right">Deducciones</Th>{canWrite && open && <Th className="w-28"><span className="sr-only">Acciones</span></Th>}</tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-mint-1">
                  <Td>
                    <Link href={`/empresas/trabajadores/${e.workerId}`} className="flex flex-col hover:text-green-700">
                      <span className="font-bold">{e.worker.firstName} {e.worker.lastName}</span>
                      <span className="text-xs text-ink-3 tabular-nums">{e.worker.docNumber}</span>
                    </Link>
                  </Td>
                  <Td className="text-right tabular-nums">{money(e.baseSalary)}</Td>
                  <Td className="text-right tabular-nums">{e.workedDays}</Td>
                  <Td className="text-right tabular-nums">{e.overtimeHours}</Td>
                  <Td className="text-right tabular-nums">{money(e.overtimeAmount)}</Td>
                  <Td className="text-right tabular-nums">{money(e.surcharges)}</Td>
                  <Td className="text-right tabular-nums">{money(e.deductions)}</Td>
                  {canWrite && open && <Td className="text-right"><Button variant="ghost" size="sm" onClick={() => setEdit(e)}>Corregir</Button></Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={p.entries.length ? "Sin coincidencias" : "Sin registros de nómina"} text={p.entries.length ? undefined : "Carga el archivo del periodo o espera la sincronización del ERP."} />
        )}
      </SectionCard>

      <EntryDialog
        entry={edit}
        periodId={p.id}
        onClose={() => setEdit(null)}
        onDone={() => {
          setMsg("Registro corregido.");
          reload();
        }}
      />
      <BudgetDialog open={budget} onClose={() => setBudget(false)} periodId={p.id} current={p.budget} onDone={() => (setMsg("Presupuesto actualizado."), reload())} />
      <PayrollUploadDialog open={upload} onClose={() => setUpload(false)} periods={[p]} defaultPeriod={p.id} />
    </>
  );
}

const fields: [keyof Entry, string][] = [
  ["baseSalary", "Salario base"],
  ["workedDays", "Días trabajados"],
  ["overtimeHours", "Horas extra"],
  ["overtimeAmount", "Valor horas extra"],
  ["surcharges", "Recargos"],
  ["deductions", "Deducciones"],
];

function EntryDialog({ entry, periodId, onClose, onDone }: { entry: Entry | null; periodId: string; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    if (!entry) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, number> = {};
    for (const [k] of fields) if (f[k] !== "" && Number(f[k]) !== Number(entry[k])) body[k] = Number(f[k]);
    if (!Object.keys(body).length) return onClose();
    const ok = await run(() => api(`/payroll/periods/${periodId}/entries/${entry.workerId}`, { method: "PATCH", body }));
    if (ok) {
      onDone();
      onClose();
    }
  }
  return (
    <Dialog
      open={!!entry}
      onClose={onClose}
      title="Corregir registro"
      sub={entry ? `${entry.worker.firstName} ${entry.worker.lastName} · ${entry.worker.docNumber}` : undefined}
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Guardar corrección"}</Button>
        </>
      }
    >
      {entry && (
        <div key={entry.id} className="grid grid-cols-2 gap-4">
          {fields.map(([k, label]) => (
            <FormField key={k} label={label}>
              <TextInput name={k} type="number" min={0} step={k === "overtimeHours" ? "0.5" : "1"} defaultValue={Number(entry[k])} />
            </FormField>
          ))}
        </div>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

function BudgetDialog({ open, onClose, periodId, current, onDone }: { open: boolean; onClose: () => void; periodId: string; current: number | null; onDone: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Presupuesto de nómina"
      sub="Se usa para comparar lo proyectado contra lo presupuestado."
      onSubmit={async (e) => {
        const v = Number(String(new FormData(e.currentTarget).get("budget")).replace(/\D/g, ""));
        if (!v) return;
        const ok = await run(() => api(`/payroll/periods/${periodId}/budget`, { method: "PATCH", body: { budget: v } }));
        if (ok) {
          onDone();
          onClose();
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </>
      }
    >
      <FormField label="Presupuesto (pesos)"><TextInput name="budget" inputMode="numeric" required pattern="[0-9.]+" defaultValue={current ?? ""} /></FormField>
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}
