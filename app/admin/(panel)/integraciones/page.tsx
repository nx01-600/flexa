"use client";

import Link from "next/link";
import { Async, PageHeader, Status, dateTime } from "@/components/flexa/admin/admin-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Card } from "@/components/flexa/ui";
import { useApi } from "@/lib/api";

type Integration = {
  id: string;
  name: string;
  integrationType: "FILE" | "ERP_API";
  integrationStatus: string;
  erpName: string | null;
  lastSyncAt: string | null;
  lastUpload: { status: string; createdAt: string; fileName: string | null } | null;
  stale: boolean;
};

export default function Integrations() {
  const state = useApi<Integration[]>("/admin/integrations");
  return (
    <>
      <PageHeader title="Integraciones" sub="Cómo llega la nómina de cada empresa y cuándo se actualizó por última vez." />
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay empresas con integración.">
        {(rows) => {
          const sorted = [...rows].sort((a, b) => Number(b.stale) - Number(a.stale) || a.name.localeCompare(b.name));
          const stale = rows.filter((r) => r.stale).length;
          return (
            <Card className="flex flex-col gap-3 p-4">
              {stale > 0 && (
                <p className="px-2 pt-1 text-sm font-semibold text-warning">
                  {stale} empresa(s) sin sincronizar hace más de 15 días.
                </p>
              )}
              <Table>
                <thead>
                  <tr>
                    <Th>Empresa</Th>
                    <Th>Tipo</Th>
                    <Th>Estado</Th>
                    <Th>Última sincronización</Th>
                    <Th>Último cargue</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <Link href={`/admin/empresas/${r.id}`} className="font-bold hover:text-green-700">
                          {r.name}
                        </Link>
                      </Td>
                      <Td>{r.integrationType === "ERP_API" ? `API ERP${r.erpName ? ` · ${r.erpName}` : ""}` : "Archivo CSV"}</Td>
                      <Td>
                        <Status value={r.integrationStatus} />
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          {dateTime(r.lastSyncAt)}
                          {r.stale && <Badge tone="amber">Desactualizada</Badge>}
                        </span>
                      </Td>
                      <Td>
                        {r.lastUpload ? (
                          <span className="flex items-center gap-2">
                            <Status value={r.lastUpload.status} />
                            <span className="text-[13px] text-ink-2">{dateTime(r.lastUpload.createdAt)}</span>
                          </span>
                        ) : (
                          <span className="text-ink-3">Sin cargues</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          );
        }}
      </Async>
    </>
  );
}
