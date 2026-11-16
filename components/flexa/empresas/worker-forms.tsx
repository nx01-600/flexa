"use client";

import { useState, type FormEvent } from "react";
import { contractTypes, Dialog, FilePick, FormField, Notice, Select, TextInput, useAction } from "@/components/flexa/empresas/kit";
import type { Site, Worker } from "@/components/flexa/empresas/types";
import { Button } from "@/components/flexa/ui";
import { api, useApi } from "@/lib/api";

type UploadResult = { created: number; updated: number; errors: { row: number; message: string }[] };

export function WorkerBulkUpload({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const { busy, error, run } = useAction();
  const close = () => {
    setFile(null);
    setResult(null);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Cargar trabajadores"
      sub="Crea o actualiza trabajadores en lote. Los documentos existentes se actualizan."
      onSubmit={async () => {
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        const r = await run(() => api<UploadResult>("/company/workers/upload", { form }));
        if (r) {
          setResult(r);
          onDone();
        }
      }}
      footer={
        result ? (
          <Button type="button" size="sm" onClick={close}>Listo</Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={close}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={!file || busy}>{busy ? "Cargando…" : "Cargar archivo"}</Button>
          </>
        )
      }
    >
      {!result ? (
        <>
          <FilePick file={file} onFile={setFile} hint="Columnas: documento, nombres, apellidos, correo, salario, cargo, sede, telefono, contrato" />
          <p className="text-[13px] font-medium text-ink-2">
            Las columnas <b>documento, nombres, correo y salario</b> son obligatorias. La sede se busca por nombre o ciudad.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Creados", result.created],
              ["Actualizados", result.updated],
              ["Con errores", result.errors.length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-mint-1 p-4">
                <p className="text-[13px] font-semibold text-ink-2">{k}</p>
                <p className="text-2xl font-extrabold text-ink tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-md bg-danger-soft/50 p-3">
              {result.errors.map((e) => (
                <li key={e.row} className="text-sm font-medium text-ink">
                  <b className="tabular-nums">Fila {e.row}:</b> {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

// Create (all fields) or edit (labor info only) form.
export function WorkerForm({ worker, onSaved, onCancel }: { worker?: Worker; onSaved: (w: Worker) => void; onCancel?: () => void }) {
  const sites = useApi<Site[]>("/company/sites");
  const { busy, error, run } = useAction();
  const edit = !!worker;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) if (v !== "") body[k] = k === "baseSalary" ? Number(v.replace(/\D/g, "")) : v;
    if (edit && f.retired === "on") body.status = "RETIRED";
    delete body.retired;
    const saved = await run(() => api<Worker>(edit ? `/company/workers/${worker.id}` : "/company/workers", { method: edit ? "PATCH" : "POST", body }));
    if (saved) onSaved(saved);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {!edit && (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nombres"><TextInput name="firstName" required autoComplete="off" /></FormField>
          <FormField label="Apellidos"><TextInput name="lastName" required autoComplete="off" /></FormField>
          <FormField label="Tipo de documento">
            <Select name="docType" defaultValue="CC" options={[{ value: "CC", label: "Cédula de ciudadanía" }, { value: "CE", label: "Cédula de extranjería" }, { value: "PPT", label: "Permiso de protección temporal" }]} />
          </FormField>
          <FormField label="Número de documento"><TextInput name="docNumber" required inputMode="numeric" pattern="[0-9]{5,12}" title="Solo números, entre 5 y 12 dígitos" /></FormField>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Correo"><TextInput name="email" type="email" required={!edit} defaultValue={worker?.email} /></FormField>
        <FormField label="Celular"><TextInput name="phone" inputMode="tel" defaultValue={worker?.phone ?? ""} /></FormField>
        <FormField label="Cargo"><TextInput name="position" defaultValue={worker?.position ?? ""} /></FormField>
        <FormField label="Sede">
          <Select name="siteId" defaultValue={worker?.siteId ?? ""} options={(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))} placeholder="Sin sede" />
        </FormField>
        <FormField label="Tipo de contrato">
          <Select name="contractType" defaultValue={worker?.contractType ?? "INDEFINIDO"} options={contractTypes} />
        </FormField>
        <FormField label="Salario base mensual" hint="En pesos, sin puntos.">
          <TextInput name="baseSalary" required={!edit} inputMode="numeric" pattern="[0-9.]+" defaultValue={worker?.baseSalary} />
        </FormField>
        {!edit && <FormField label="Fecha de ingreso"><TextInput name="hireDate" type="date" /></FormField>}
      </div>
      {edit && worker.status !== "RETIRED" && (
        <label className="flex items-center gap-3 text-sm font-semibold text-ink">
          <input type="checkbox" name="retired" className="size-4 accent-red-600" />
          Marcar como retirado de la empresa (deshabilita su acceso)
        </label>
      )}
      {error && <Notice tone="red">{error}</Notice>}
      <div className="flex justify-end gap-3">
        {onCancel && <Button type="button" variant="outline" size="md" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" size="md" disabled={busy}>{busy ? "Guardando…" : edit ? "Guardar cambios" : "Registrar trabajador"}</Button>
      </div>
    </form>
  );
}
