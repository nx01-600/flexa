"use client";

import { useRouter } from "next/navigation";
import { Suspense, useDeferredValue } from "react";
import { History } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { dateTime, EmptyState, ErrorState, FormField, Loading, PageLoading, roleLabel, SectionCard, Select, TextInput, useQueryState } from "@/components/flexa/empresas/kit";
import type { AuditEntry } from "@/components/flexa/empresas/types";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge } from "@/components/flexa/ui";
import { useApi } from "@/lib/api";

const entities: Record<string, string> = {
  Worker: "Trabajador",
  Advance: "Solicitud",
  CompanySettings: "Reglas",
  PayrollPeriod: "Periodo de nómina",
  PayrollUpload: "Carga de nómina",
  PayrollEntry: "Registro de nómina",
  PayrollIssue: "Inconsistencia",
  PayrollNovelty: "Novedad",
  CompensationLine: "Línea de compensación",
  Reconciliation: "Conciliación",
  Incident: "Incidencia",
  Company: "Empresa",
  Site: "Sede",
  User: "Usuario",
  SupportTicket: "Soporte",
};

const actions: Record<string, string> = {
  LOGIN: "Inicio de sesión",
  CREATED: "Creación",
  UPDATED: "Actualización",
  ENABLED: "Habilitado",
  DISABLED: "Deshabilitado",
  LABOR_INFO_UPDATED: "Información laboral",
  APPROVED: "Aprobación",
  REJECTED: "Rechazo",
  CLOSED: "Cierre",
  RECONCILED: "Conciliación",
  RESOLVED: "Resuelta",
  CORRECTED: "Corrección",
  INGESTED: "Carga procesada",
  BUDGET_SET: "Presupuesto",
  ADJUSTED: "Ajuste",
  API_KEY_ROTATED: "API key generada",
  COMPENSATION_REPORTED: "Descuentos reportados",
  ACTIVATED: "Activado",
  DEACTIVATED: "Desactivado",
  REQUESTED: "Solicitud",
  CANCELLED: "Cancelación",
  DISBURSING: "Desembolsando",
  DISBURSED: "Desembolso",
  DISBURSEMENT_FAILED: "Desembolso fallido",
  EXCEPTION_APPROVED: "Excepción aprobada",
  EXCEPTION_REJECTED: "Excepción rechazada",
  REGISTERED: "Registro",
  KYC_APPROVED: "Identidad verificada",
  PROFILE_UPDATED: "Perfil actualizado",
  TEAM_MEMBER_ADDED: "Miembro agregado",
  COMPENSATION_EXPORTED: "Descuentos exportados",
  REMOVED: "Eliminación",
  PUBLISHED: "Publicación",
  ESCALATED: "Escalado",
  DEMO_DATA_LOADED: "Datos de demostración",
};

// Compact, readable rendering of the audit payload.
function Data({ value }: { value: unknown }) {
  if (value == null) return <span className="text-ink-3">—</span>;
  const text = JSON.stringify(value);
  return (
    <span title={text} className="block max-w-[420px] truncate font-mono text-xs text-ink-2">
      {text}
    </span>
  );
}

function Audit() {
  const [entity, setEntity] = useQueryState("entidad");
  const [entityId, setEntityId] = useQueryState("id");
  const router = useRouter();
  const id = useDeferredValue(entityId.trim());
  const qs = new URLSearchParams(Object.entries({ entity, entityId: id }).filter(([, v]) => v));
  const { data, error, loading, reload } = useApi<AuditEntry[]>(`/company/audit?${qs}`);
  return (
    <>
      <PageHeader title="Trazabilidad" sub="Registro de todas las acciones relevantes en tu empresa: quién, qué y cuándo." />
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Entidad" className="w-full sm:w-60">
            <Select value={entity} onChange={(e) => setEntity(e.target.value)} options={Object.entries(entities).map(([value, label]) => ({ value, label }))} placeholder="Todas" />
          </FormField>
          <FormField label="ID del registro" className="w-full sm:w-80">
            <TextInput value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Opcional" />
          </FormField>
          <span className="ml-auto text-sm font-semibold text-ink-2 tabular-nums sm:mb-3">{data ? `${data.length} eventos` : ""}</span>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading rows={8} />
        ) : !data?.length ? (
          <EmptyState icon={History} title="Sin eventos" text="No hay acciones registradas para este filtro." />
        ) : (
          <Table>
            <thead><tr><Th>Fecha</Th><Th>Quién</Th><Th>Entidad</Th><Th>Acción</Th><Th>Detalle</Th></tr></thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id}>
                  <Td className="text-ink-2 tabular-nums">{dateTime(l.createdAt)}</Td>
                  <Td>
                    {l.actor ? (
                      <span className="flex flex-col">
                        <span className="font-bold">{l.actor.name}</span>
                        <span className="text-xs text-ink-3">{roleLabel[l.actor.role] ?? l.actor.role}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">Sistema</span>
                    )}
                  </Td>
                  <Td>
                    <button type="button" className="text-left hover:text-green-700" onClick={() => router.replace(`?${new URLSearchParams({ entidad: l.entity, ...(l.entityId ? { id: l.entityId } : {}) })}`, { scroll: false })} title="Filtrar por este registro">
                      {entities[l.entity] ?? l.entity}
                    </button>
                  </Td>
                  <Td><Badge tone="gray">{actions[l.action] ?? l.action}</Badge></Td>
                  <Td><Data value={l.data} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}


export default function AuditPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Audit />
    </Suspense>
  );
}
