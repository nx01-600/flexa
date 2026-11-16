"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Async, CompanySelect, ErrorText, Labeled, PageHeader, Select, Status, dateTime, qs, statusLabel, type CompanyRow } from "@/components/flexa/admin/admin-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button, Card } from "@/components/flexa/ui";
import { api, ApiError, money, useApi } from "@/lib/api";

type Advance = {
  id: string;
  code: string;
  amount: number;
  netAmount: number;
  status: string;
  exceptionReason: string | null;
  createdAt: string;
  worker: { firstName: string; lastName: string; company: { name: string } };
  bankAccount: { bank: string } | null;
};

const statuses = ["REQUESTED", "EXCEPTION", "APPROVED", "DISBURSING", "DISBURSED", "REJECTED", "FAILED", "CANCELLED"];

function Operations() {
  const search = useSearchParams();
  const [status, setStatus] = useState(search.get("status") ?? "");
  const [companyId, setCompanyId] = useState(search.get("companyId") ?? "");
  const companies = useApi<CompanyRow[]>("/admin/companies");
  const state = useApi<Advance[]>(`/admin/advances${qs({ status, companyId })}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function retry(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/admin/advances/${id}/retry`, { method: "POST" });
      state.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo reintentar el desembolso.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Operaciones" sub="Solicitudes de anticipo de todas las empresas. Reintenta los desembolsos fallidos." />
      <div className="flex flex-wrap items-end gap-4">
        <Labeled label="Estado">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-48">
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
        </Labeled>
        <CompanySelect companies={companies.data} value={companyId} onChange={setCompanyId} />
      </div>
      <ErrorText>{error}</ErrorText>
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay operaciones con estos filtros.">
        {(rows) => (
          <Card className="p-4">
            {rows.length === 300 && <p className="px-2 pb-2 text-[13px] font-semibold text-ink-2">Mostrando las 300 más recientes. Filtra para acotar.</p>}
            <Table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Trabajador</Th>
                  <Th>Empresa</Th>
                  <Th className="text-right">Monto</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                  <Th>
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-bold tabular-nums">{a.code}</Td>
                    <Td>
                      {a.worker.firstName} {a.worker.lastName}
                    </Td>
                    <Td className="text-ink-2">{a.worker.company.name}</Td>
                    <Td className="text-right font-bold tabular-nums">{money(a.amount)}</Td>
                    <Td>
                      <span title={a.exceptionReason ?? undefined}>
                        <Status value={a.status} />
                      </span>
                    </Td>
                    <Td className="text-[13px] text-ink-2">{dateTime(a.createdAt)}</Td>
                    <Td className="text-right">
                      {a.status === "FAILED" && (
                        <Button size="sm" variant="soft" disabled={busy === a.id} onClick={() => retry(a.id)}>
                          {busy === a.id ? "Reintentando…" : "Reintentar"}
                        </Button>
                      )}
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

export default function OperationsPage() {
  return (
    <Suspense>
      <Operations />
    </Suspense>
  );
}
