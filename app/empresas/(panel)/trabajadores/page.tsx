"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Card } from "@/components/flexa/ui";
import { employees, money } from "@/lib/mock";

export default function Workers() {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = employees.filter((e) => !term || e.name.toLowerCase().includes(term) || e.doc.replace(/\./g, "").includes(term.replace(/\./g, "")));

  return (
    <>
      <PageHeader title="Trabajadores" sub="Personas de tu nómina y su uso de Flexa en el periodo." />
      <Card className="flex flex-col">
        <div className="flex items-center justify-between gap-4 p-4">
          <label className="relative w-full max-w-sm">
            <span className="sr-only">Buscar trabajador</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o cédula"
              className="h-11 w-full rounded-md border border-input bg-surface pr-4 pl-10 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-green-500 focus:ring-4 focus:ring-green-200/60"
            />
          </label>
          <span className="shrink-0 text-sm text-ink-2 tabular-nums">{list.length} de {employees.length}</span>
        </div>
        <Table>
          <thead>
            <tr><Th className="pl-5">Nombre</Th><Th>Cédula</Th><Th>Sede</Th><Th>Acceso</Th><Th className="text-right">Retirado</Th><Th className="pr-5">Uso del disponible</Th></tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-0">
            {list.map((e) => {
              const use = Math.round((e.withdrawn / (e.salary * 0.6)) * 100);
              return (
                <tr key={e.doc} className="hover:bg-green-50/60">
                  <Td className="pl-5 font-semibold">{e.name}</Td>
                  <Td className="text-ink-2 tabular-nums">{e.doc}</Td>
                  <Td className="text-ink-2">{e.site}</Td>
                  <Td>{e.access ? <Badge>Habilitado</Badge> : <Badge tone="gray">Sin acceso</Badge>}</Td>
                  <Td className="text-right tabular-nums">{e.access ? money(e.withdrawn) : "—"}</Td>
                  <Td className="pr-5">
                    {e.access ? (
                      <span className="flex items-center gap-3">
                        <span className="h-2 w-28 rounded-full bg-green-100">
                          <span className={`block h-full rounded-full ${use >= 70 ? "bg-warning-icon" : "bg-green-500"}`} style={{ width: `${Math.min(use, 100)}%` }} />
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${use >= 70 ? "text-warning" : "text-ink-2"}`}>{use} %</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
            {!list.length && (
              <tr><Td colSpan={6} className="h-24 text-center text-ink-2">No hay trabajadores que coincidan con «{q}».</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
