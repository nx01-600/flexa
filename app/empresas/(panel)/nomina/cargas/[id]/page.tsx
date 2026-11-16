"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { dateTime, EmptyState, ErrorState, Facts, Notice, PageLoading, SectionCard, UploadBadge, useAction, useCanWrite } from "@/components/flexa/empresas/kit";
import type { Upload } from "@/components/flexa/empresas/types";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button } from "@/components/flexa/ui";
import { api, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const sourceLabel: Record<string, string> = { FILE: "Archivo", ERP_API: "ERP", MANUAL: "Manual" };

export default function UploadDetail() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCanWrite();
  const { data: u, error, loading, reload } = useApi<Upload>(`/payroll/uploads/${id}`);
  const [showResolved, setShowResolved] = useState(false);
  const { busy, error: actionError, run } = useAction();
  const [working, setWorking] = useState<string | null>(null);

  if (loading && !u) return <PageLoading />;
  if (error || !u) return <ErrorState error={error} onRetry={reload} />;
  const issues = u.issues ?? [];
  const pending = issues.filter((i) => !i.resolved);
  const visible = showResolved ? issues : pending;

  async function resolve(issueId: string) {
    setWorking(issueId);
    await run(() => api(`/payroll/issues/${issueId}/resolve`, { method: "PATCH" }));
    setWorking(null);
    reload();
  }

  return (
    <>
      <PageHeader back={{ href: "/empresas/nomina?tab=cargas", label: "Cargas de nómina" }} title={u.fileName} sub={`Periodo ${u.period.label} · ${sourceLabel[u.source] ?? u.source} · ${dateTime(u.createdAt)}`} action={<UploadBadge value={u.status} />} />
      <SectionCard>
        <Facts
          cols={4}
          items={[
            ["Filas recibidas", u.totalRows],
            ["Filas aplicadas", u.okRows],
            ["Inconsistencias pendientes", pending.length],
            ["Resueltas", issues.length - pending.length],
          ]}
        />
      </SectionCard>
      <SectionCard>
        <CardHead
          title="Inconsistencias"
          sub="Los errores impiden aplicar la fila; las advertencias se aplican pero conviene revisarlas."
          action={issues.length > pending.length && <Button variant="ghost" size="sm" onClick={() => setShowResolved(!showResolved)}>{showResolved ? "Ocultar resueltas" : "Ver resueltas"}</Button>}
        />
        {actionError && <Notice tone="red">{actionError}</Notice>}
        {visible.length ? (
          <Table>
            <thead><tr><Th>Fila</Th><Th>Documento</Th><Th>Campo</Th><Th>Detalle</Th><Th>Tipo</Th><Th className="text-right"><span className="sr-only">Acciones</span></Th></tr></thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id} className={cn(i.resolved && "opacity-60")}>
                  <Td className="tabular-nums">{i.row || "—"}</Td>
                  <Td className="tabular-nums">{i.docNumber ?? "—"}</Td>
                  <Td className="text-ink-2">{i.field}</Td>
                  <Td className="max-w-md whitespace-normal">{i.message}</Td>
                  <Td>{i.severity === "WARNING" ? <Badge tone="amber">Advertencia</Badge> : <Badge tone="red">Error</Badge>}</Td>
                  <Td className="text-right">
                    {i.resolved ? <Badge tone="gray">Resuelta</Badge> : canWrite && <Button variant="soft" size="sm" disabled={busy && working === i.id} onClick={() => resolve(i.id)}>{busy && working === i.id ? "Marcando…" : "Marcar resuelta"}</Button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Sin inconsistencias pendientes" text="Todas las filas de esta carga se aplicaron o ya fueron revisadas." />
        )}
      </SectionCard>
    </>
  );
}
