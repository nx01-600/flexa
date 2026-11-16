"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Async, CompanySelect, Labeled, PageHeader, Select, dateTime, qs, roleLabel, type CompanyRow } from "@/components/flexa/admin/admin-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Card } from "@/components/flexa/ui";
import { useApi } from "@/lib/api";

type Log = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  data: unknown;
  createdAt: string;
  actor: { name: string; role: string } | null;
  company: { name: string } | null;
};

const entities: Record<string, string> = {
  Company: "Empresa",
  CompanySettings: "Parámetros",
  Worker: "Trabajador",
  Advance: "Anticipo",
  Incident: "Incidencia",
  SupportTicket: "Soporte",
  LegalDocument: "Documento legal",
  PayrollPeriod: "Periodo de nómina",
  PayrollUpload: "Cargue de nómina",
  Reconciliation: "Conciliación",
  User: "Usuario",
};

function Audit() {
  const search = useSearchParams();
  const [companyId, setCompanyId] = useState(search.get("companyId") ?? "");
  const [entity, setEntity] = useState("");
  const companies = useApi<CompanyRow[]>("/admin/companies");
  const state = useApi<Log[]>(`/admin/audit${qs({ companyId, entity, take: "300" })}`);
  return (
    <>
      <PageHeader title="Trazabilidad" sub="Quién hizo qué y cuándo, en todas las empresas." />
      <div className="flex flex-wrap items-end gap-4">
        <CompanySelect companies={companies.data} value={companyId} onChange={setCompanyId} />
        <Labeled label="Entidad">
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="min-w-48">
            <option value="">Todas</option>
            {Object.entries(entities).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Labeled>
      </div>
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay eventos con estos filtros.">
        {(rows) => (
          <Card className="p-4">
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Actor</Th>
                  <Th>Empresa</Th>
                  <Th>Entidad</Th>
                  <Th>Acción</Th>
                  <Th>Detalle</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <Td className="text-[13px] text-ink-2">{dateTime(l.createdAt)}</Td>
                    <Td>
                      {l.actor ? (
                        <>
                          {l.actor.name} <span className="text-[13px] text-ink-3">· {roleLabel[l.actor.role] ?? l.actor.role}</span>
                        </>
                      ) : (
                        <span className="text-ink-3">Sistema</span>
                      )}
                    </Td>
                    <Td className="text-ink-2">{l.company?.name ?? "—"}</Td>
                    <Td>{entities[l.entity] ?? l.entity}</Td>
                    <Td className="font-mono text-[13px] font-semibold">{l.action}</Td>
                    <Td className="max-w-[280px] truncate font-mono text-xs text-ink-2" title={l.data ? JSON.stringify(l.data) : undefined}>
                      {l.data ? JSON.stringify(l.data) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </Async>
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <Audit />
    </Suspense>
  );
}
