"use client";

import { CalendarDays, Check, ChevronRight, CloudUpload, Download, FileSpreadsheet, Lock, Percent, Repeat, UserCheck, Wallet, X } from "@/components/flexa/icons";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { Avatar, CardHead, CheckDot, Kebab, Kpi } from "@/components/flexa/empresas-ui";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Blob } from "@/components/flexa/shapes";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card, IconBox } from "@/components/flexa/ui";
import { company, employees, money, payrollUploads } from "@/lib/mock";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "cargar", label: "Cargar nómina" },
  { value: "historial", label: "Historial" },
  { value: "trabajadores", label: "Trabajadores" },
  { value: "parametros", label: "Parámetros" },
] as const;

type Tab = (typeof tabs)[number]["value"];
type Upload = (typeof payrollUploads)[number];

// Mock file names come without the accent; show them the way the mockup does.
const fileLabel = (f: string) => f.replace(/^Nomina_/, "Nómina_");

export default function Payroll() {
  const [tab, setTab] = useState<Tab>("cargar");
  const [uploads, setUploads] = useState<Upload[]>(payrollUploads);

  return (
    <>
      <PageHeader title="Gestión de nómina" sub="Carga, revisa y controla la información de tu nómina." />
      <PillTabs variant="segmented" options={tabs} value={tab} onChange={setTab} />
      {tab === "cargar" && (
        <>
          <UploadPanel onDone={(u) => setUploads((l) => [u, ...l])} />
          <UploadsTable rows={uploads.slice(0, 3)} title="Últimas cargas" onAll={() => setTab("historial")} />
        </>
      )}
      {tab === "historial" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Kpi icon={FileSpreadsheet} value={uploads.length} label="Archivos cargados este año" />
            <Kpi icon={Check} value={uploads.filter((u) => u.status === "Procesada").length} label="Procesadas sin novedades" tone="teal" />
            <Kpi icon={CalendarDays} value="15 nov" label="Próxima carga sugerida" tone="amber" />
          </div>
          <UploadsTable rows={uploads} title="Historial de cargas" />
        </>
      )}
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
    <Card className="grid gap-8 p-6 xl:grid-cols-[1.35fr_1fr]">
      <div className="flex flex-col gap-4">
        <CardHead title="Cargar archivo de nómina" sub="Sube el archivo del periodo para actualizar salarios y cupos." />
        {!file ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={cn(
              "relative isolate flex min-h-60 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors duration-150",
              drag ? "border-green-500 bg-green-100" : "border-green-300 bg-card-soft hover:border-green-400",
            )}
          >
            <Blob shape={2} className="-right-16 -bottom-20 -z-10 size-[220px] opacity-50" />
            <IconBox size="lg" halo className="size-16 [&_svg]:size-8">
              <CloudUpload />
            </IconBox>
            <span className="mt-1 flex flex-col gap-0.5">
              <span className="text-base font-extrabold text-ink">Arrastra tu archivo aquí</span>
              <span className="text-sm font-medium text-ink-2">o selecciónalo desde tu computador</span>
            </span>
            <span className="mt-1 inline-flex h-11 items-center rounded-md bg-btn-primary px-5 text-sm font-bold text-white shadow-btn">Seleccionar archivo</span>
            <span className="text-xs font-semibold text-ink-3">Formatos aceptados: .xlsx, .csv</span>
            <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="flex min-h-60 flex-col justify-center gap-5 rounded-lg bg-card-soft p-6 ring-1 ring-line-soft">
            <div className="flex items-center gap-3.5">
              <IconBox><FileSpreadsheet /></IconBox>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-bold text-ink">{file.name}</span>
                <span className="text-[13px] font-medium text-ink-2">{(file.size / 1024).toFixed(1)} KB</span>
              </span>
              {state !== "working" && (
                <button type="button" onClick={() => { setFile(null); setState("idle"); }} aria-label="Quitar archivo" className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink">
                  <X className="size-[18px]" />
                </button>
              )}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-green-100">
              <div className={cn("h-full rounded-full bg-btn-primary transition-[width] duration-[1200ms] ease-out", state === "idle" ? "w-0" : "w-full")} />
            </div>
            {state === "done" ? (
              <p className="flex items-center gap-2.5 text-[15px] font-bold text-green-700"><CheckDot /> Nómina procesada. 250 trabajadores actualizados.</p>
            ) : (
              <Button size="md" className="self-start" onClick={process} disabled={state === "working"}>
                {state === "working" ? "Procesando..." : "Procesar nómina"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 xl:border-l xl:border-line-soft xl:pl-8">
        <CardHead title="¿Qué incluye el archivo?" />
        <ul className="flex flex-col gap-3 text-[15px] font-medium text-ink">
          {["Información básica del trabajador", "Salario y periodicidad", "Datos de cuenta (opcional)", "Fechas de pago", "Novedades (opcional)"].map((t) => (
            <li key={t} className="flex items-center gap-3"><CheckDot />{t}</li>
          ))}
        </ul>
        <Button variant="outline" size="md" className="mt-2 self-start"><Download className="text-green-700" />Descargar plantilla</Button>
        <div className="mt-auto flex items-start gap-3 rounded-md bg-mint-1 p-4">
          <Lock className="mt-0.5 size-[18px] shrink-0 text-green-700" />
          <p className="text-[13px] font-medium text-ink-2">Tus archivos viajan cifrados y solo los ve el equipo autorizado de tu empresa.</p>
        </div>
      </div>
    </Card>
  );
}

function UploadsTable({ rows, title, onAll }: { rows: Upload[]; title: string; onAll?: () => void }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHead
        title={title}
        action={
          onAll && (
            <button type="button" onClick={onAll} className="-mr-3 inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-bold text-green-700 transition-colors hover:bg-green-100 [&_svg]:size-4">
              Ver todas
              <ChevronRight />
            </button>
          )
        }
      />
      <Table>
        <thead>
          <tr><Th>Archivo</Th><Th>Fecha</Th><Th>Periodo</Th><Th>Estado</Th><Th className="text-right">Trabajadores</Th><Th className="w-14"><span className="sr-only">Acciones</span></Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.file + r.date} className="transition-colors hover:bg-mint-1">
              <Td>
                <span className="flex items-center gap-3">
                  <IconBox size="sm"><FileSpreadsheet /></IconBox>
                  <span className="font-bold">{fileLabel(r.file)}</span>
                </span>
              </Td>
              <Td className="text-ink-2">{r.date}</Td>
              <Td className="text-ink-2">{r.period}</Td>
              <Td><Badge tone={r.status === "Procesada" ? "green" : "amber"}>{r.status}</Badge></Td>
              <Td className="text-right font-bold tabular-nums">{r.workers}</Td>
              <Td className="text-right"><Kebab label={`Acciones para ${fileLabel(r.file)}`} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function PayrollWorkers() {
  const total = employees.reduce((a, e) => a + e.salary, 0);
  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHead title="Trabajadores en la nómina" sub={`${employees.length} personas en el archivo de octubre · ${money(total)} en salarios`} />
      <Table>
        <thead>
          <tr><Th>Nombre</Th><Th>Cédula</Th><Th>Sede</Th><Th className="text-right">Salario</Th><Th>Periodicidad</Th></tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.doc} className="transition-colors hover:bg-mint-1">
              <Td>
                <span className="flex items-center gap-3"><Avatar name={e.name} /><span className="font-bold">{e.name}</span></span>
              </Td>
              <Td className="text-ink-2 tabular-nums">{e.doc}</Td>
              <Td className="text-ink-2">{e.site}</Td>
              <Td className="text-right font-bold tabular-nums">{money(e.salary)}</Td>
              <Td><Badge tone="teal">Quincenal</Badge></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function Params() {
  const params = [
    { icon: Repeat, k: "Periodicidad de pago", v: "Quincenal (15 y 30)" },
    { icon: Percent, k: "Porcentaje retirable", v: "30% a 60% según perfil" },
    { icon: UserCheck, k: "Trabajadores habilitados", v: `${company.withAccess} de ${company.activeWorkers}` },
    { icon: CalendarDays, k: "Día de corte para retiros", v: "2 días antes del pago" },
    { icon: Wallet, k: "Descuento del anticipo", v: "Automático en la nómina siguiente" },
  ];
  return (
    <>
      <Card tone="mint" className="relative isolate flex items-center gap-4 overflow-hidden p-5">
        <Blob shape={0} tone="deep" className="-top-16 -right-10 -z-10 size-48 opacity-60" />
        <IconBox tone="dark"><Lock /></IconBox>
        <p className="flex-1 text-[15px] font-semibold text-green-900">Estos parámetros los configura el equipo de Flexa después de la prueba piloto. Si necesitas un cambio, escríbenos.</p>
        <Button variant="outline" size="sm">Contactar a Flexa</Button>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {params.map(({ icon: Icon, k, v }) => (
          <Card key={k} tone="soft" className="flex items-center gap-4 p-5 last:xl:col-span-2">
            <IconBox size="lg"><Icon /></IconBox>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-ink-2">{k}</span>
              <span className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">{v}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
