"use client";

import { Check, CloudUpload, Download, FileSpreadsheet, Lock, X } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card } from "@/components/flexa/ui";
import { employees, money, payrollUploads } from "@/lib/mock";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "cargar", label: "Cargar nómina" },
  { value: "historial", label: "Historial" },
  { value: "trabajadores", label: "Trabajadores" },
  { value: "parametros", label: "Parámetros" },
] as const;

type Upload = (typeof payrollUploads)[number];

export default function Payroll() {
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("cargar");
  const [uploads, setUploads] = useState<Upload[]>(payrollUploads);

  return (
    <>
      <PageHeader title="Gestión de nómina" sub="Carga, revisa y controla la información de tu nómina." />
      <PillTabs options={tabs} value={tab} onChange={setTab} className="self-start" />
      {tab === "cargar" && (
        <>
          <UploadPanel onDone={(u) => setUploads((l) => [u, ...l])} />
          <UploadsTable rows={uploads.slice(0, 3)} title="Últimas cargas" />
        </>
      )}
      {tab === "historial" && <UploadsTable rows={uploads} title="Historial de cargas" />}
      {tab === "trabajadores" && <PayrollWorkers />}
      {tab === "parametros" && <Params />}
    </>
  );
}

function UploadPanel({ onDone }: { onDone: (u: Upload) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f);
    setState("idle");
  };

  const process = () => {
    if (!file) return;
    setState("working");
    setTimeout(() => {
      setState("done");
      onDone({ file: file.name, date: "30 oct 2026", period: "Nov 2026", status: "Procesada", workers: 250 });
    }, 1200);
  };

  return (
    <Card className="grid gap-6 p-5 xl:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">Cargar archivo de nómina</h2>
        {!file ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={cn(
              "flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 text-center transition-colors",
              drag ? "border-green-500 bg-green-100" : "border-green-300 bg-green-50 hover:bg-green-100/60",
            )}
          >
            <CloudUpload className="size-9 text-green-600" />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold text-ink">Arrastra tu archivo aquí</span>
              <span className="text-sm text-ink-2">o selecciónalo desde tu computador</span>
            </span>
            <span className="mt-1 inline-flex h-10 items-center rounded-md bg-green-600 px-4 text-sm font-bold text-white">Seleccionar archivo</span>
            <span className="text-xs text-ink-3">Formatos aceptados: .xlsx, .csv</span>
            <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="flex min-h-52 flex-col justify-center gap-4 rounded-lg border border-line bg-green-50 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-surface text-green-700"><FileSpreadsheet className="size-5" /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-ink">{file.name}</span>
                <span className="text-xs text-ink-2">{(file.size / 1024).toFixed(1)} KB</span>
              </span>
              {state !== "working" && (
                <button type="button" onClick={() => { setFile(null); setState("idle"); }} aria-label="Quitar archivo" className="grid size-9 place-items-center rounded-md text-ink-3 hover:bg-surface hover:text-ink">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={cn("h-full rounded-full bg-green-500 transition-[width] duration-[1200ms] ease-out", state === "idle" ? "w-0" : "w-full")} />
            </div>
            {state === "done" ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><Check className="size-4" /> Nómina procesada. 250 trabajadores actualizados.</p>
            ) : (
              <Button size="md" className="self-start" onClick={process} disabled={state === "working"}>
                {state === "working" ? "Procesando..." : "Procesar nómina"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 xl:border-l xl:border-line xl:pl-6">
        <h2 className="text-base font-bold text-ink">¿Qué incluye el archivo?</h2>
        <ul className="flex flex-col gap-2.5 text-sm text-ink">
          {["Información básica del trabajador", "Salario y periodicidad", "Datos de cuenta (opcional)", "Fechas de pago", "Novedades (opcional)"].map((t) => (
            <li key={t} className="flex items-center gap-2.5"><Check className="size-4 text-green-600" />{t}</li>
          ))}
        </ul>
        <a href="#" className="mt-auto inline-flex items-center gap-2 self-start text-sm font-bold text-green-700 hover:underline">
          <Download className="size-4" /> Descargar plantilla
        </a>
      </div>
    </Card>
  );
}

function UploadsTable({ rows, title }: { rows: Upload[]; title: string }) {
  return (
    <Card className="flex flex-col gap-2 pt-5">
      <h2 className="px-5 text-base font-bold text-ink">{title}</h2>
      <Table>
        <thead>
          <tr><Th className="pl-5">Archivo</Th><Th>Fecha</Th><Th>Periodo</Th><Th>Estado</Th><Th className="pr-5 text-right">Trabajadores</Th></tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-0">
          {rows.map((r) => (
            <tr key={r.file + r.date} className="transition-colors hover:bg-green-50/60">
              <Td className="pl-5 font-semibold">{r.file}</Td>
              <Td className="text-ink-2">{r.date}</Td>
              <Td className="text-ink-2">{r.period}</Td>
              <Td><Badge tone={r.status === "Procesada" ? "green" : "amber"}>{r.status}</Badge></Td>
              <Td className="pr-5 text-right tabular-nums">{r.workers}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function PayrollWorkers() {
  return (
    <Card className="pt-2">
      <Table>
        <thead>
          <tr><Th className="pl-5">Nombre</Th><Th>Cédula</Th><Th>Sede</Th><Th className="text-right">Salario</Th><Th className="pr-5">Periodicidad</Th></tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-0">
          {employees.map((e) => (
            <tr key={e.doc} className="hover:bg-green-50/60">
              <Td className="pl-5 font-semibold">{e.name}</Td>
              <Td className="text-ink-2 tabular-nums">{e.doc}</Td>
              <Td className="text-ink-2">{e.site}</Td>
              <Td className="text-right tabular-nums">{money(e.salary)}</Td>
              <Td className="pr-5 text-ink-2">Quincenal</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function Params() {
  const params = [
    ["Periodicidad de pago", "Quincenal (15 y 30)"],
    ["Porcentaje retirable", "30 % a 60 % según perfil"],
    ["Trabajadores habilitados", "180 de 250"],
    ["Día de corte para retiros", "2 días antes del pago"],
    ["Descuento del anticipo", "Automático en la nómina siguiente"],
  ];
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3 rounded-md bg-green-50 p-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-green-700" />
        <p className="text-sm text-ink">Estos parámetros los configura el equipo de Flexa después de la prueba piloto. Si necesitas un cambio, escríbenos.</p>
      </div>
      <dl className="grid gap-x-10 sm:grid-cols-2">
        {params.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-line py-3.5 text-sm">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-right font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
