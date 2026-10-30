"use client";

import { ChevronLeft, ChevronRight, Download, MapPin, Search, TriangleAlert, UserCheck, UserX, Users } from "lucide-react";
import { useState } from "react";
import { Choice } from "@/components/flexa/choice";
import { PageHeader } from "@/components/flexa/company-shell";
import { Avatar, Kebab, Kpi } from "@/components/flexa/empresas-ui";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card } from "@/components/flexa/ui";
import { company, employees, money } from "@/lib/mock";
import { cn } from "@/lib/utils";

const access = [
  { value: "todos", label: "Todos" },
  { value: "si", label: "Habilitados" },
  { value: "no", label: "Sin acceso" },
] as const;

const allSites = "Todas las sedes";
const siteOptions = [allSites, ...new Set(employees.map((e) => e.site))];

const usage = (e: (typeof employees)[number]) => Math.round((e.withdrawn / (e.salary * 0.6)) * 100);

export default function Workers() {
  const [q, setQ] = useState("");
  const [acc, setAcc] = useState<(typeof access)[number]["value"]>("todos");
  const [site, setSite] = useState(allSites);
  const term = q.trim().toLowerCase();
  const list = employees.filter(
    (e) =>
      (!term || e.name.toLowerCase().includes(term) || e.doc.replace(/\./g, "").includes(term.replace(/\./g, ""))) &&
      (acc === "todos" || e.access === (acc === "si")) &&
      (site === allSites || e.site === site),
  );

  return (
    <>
      <PageHeader
        title="Trabajadores"
        sub="Personas de tu nómina y su uso de Flexa en el periodo."
        action={<Button variant="outline" size="md"><Download className="text-green-700" />Exportar lista</Button>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={Users} value={company.activeWorkers} label="Trabajadores en nómina" />
        <Kpi icon={UserCheck} value={company.withAccess} label="Habilitados en Flexa" tone="teal" />
        <Kpi icon={UserX} value={company.activeWorkers - company.withAccess} label="Sin acceso todavía" tone="green" />
        <Kpi icon={TriangleAlert} value={employees.filter((e) => e.access && usage(e) >= 70).length} label="Con uso alto de retiros" tone="amber" />
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Buscar trabajador</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o cédula"
              className="h-11 w-full rounded-md border-[1.5px] border-input bg-surface pr-4 pl-12 text-[15px] font-medium text-ink shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-ink-3 focus:border-green-500 focus:ring-4 focus:ring-green-200/70"
            />
          </label>
          <Choice options={siteOptions} value={site} onChange={setSite} icon={MapPin} className="h-11 w-56 text-sm font-semibold data-[size=default]:h-11" />
          <PillTabs options={access} value={acc} onChange={setAcc} className="[&>button]:h-11 [&>button]:px-5" />
        </div>

        <Table>
          <thead>
            <tr><Th>Nombre</Th><Th>Cédula</Th><Th>Sede</Th><Th>Acceso</Th><Th className="text-right">Retirado</Th><Th>Uso del disponible</Th><Th className="w-14"><span className="sr-only">Acciones</span></Th></tr>
          </thead>
          <tbody>
            {list.map((e) => {
              const use = usage(e);
              const high = use >= 70;
              return (
                <tr key={e.doc} className="transition-colors hover:bg-mint-1">
                  <Td>
                    <span className="flex items-center gap-3"><Avatar name={e.name} /><span className="font-bold">{e.name}</span></span>
                  </Td>
                  <Td className="text-ink-2 tabular-nums">{e.doc}</Td>
                  <Td className="text-ink-2">{e.site}</Td>
                  <Td>{e.access ? <Badge>Habilitado</Badge> : <Badge tone="gray">Sin acceso</Badge>}</Td>
                  <Td className="text-right font-bold tabular-nums">{e.access ? money(e.withdrawn) : "—"}</Td>
                  <Td>
                    {e.access ? (
                      <span className="flex items-center gap-3">
                        <span className="h-2 w-28 rounded-full bg-green-100">
                          <span
                            className={cn("block h-full rounded-full", high ? "bg-linear-to-r from-[#f2c14e] to-warning-icon" : "bg-linear-to-r from-green-300 to-green-500")}
                            style={{ width: `${Math.min(use, 100)}%` }}
                          />
                        </span>
                        <span className={cn("w-10 text-[13px] font-bold tabular-nums", high ? "text-warning" : "text-ink-2")}>{use}%</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="text-right"><Kebab label={`Acciones para ${e.name}`} /></Td>
                </tr>
              );
            })}
            {!list.length && (
              <tr><Td colSpan={7} className="h-24 text-center text-ink-2">No hay trabajadores que coincidan con la búsqueda.</Td></tr>
            )}
          </tbody>
        </Table>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-semibold text-ink-2 tabular-nums">Mostrando {list.length} de {company.activeWorkers} trabajadores</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Página anterior" disabled className="grid size-10 place-items-center rounded-full bg-surface text-ink-3 shadow-sm disabled:opacity-60 [&_svg]:size-[18px]">
              <ChevronLeft />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                aria-current={p === 1 ? "page" : undefined}
                className={cn("grid size-10 place-items-center rounded-full text-sm font-bold tabular-nums transition-colors", p === 1 ? "bg-btn-primary text-white shadow-btn" : "text-ink-2 hover:bg-green-100")}
              >
                {p}
              </button>
            ))}
            <button type="button" aria-label="Página siguiente" className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm transition-colors hover:text-green-700 [&_svg]:size-[18px]">
              <ChevronRight />
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
