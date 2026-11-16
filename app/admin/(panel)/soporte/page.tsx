"use client";

import Link from "next/link";
import { useState } from "react";
import { Async, Labeled, PageHeader, Select, Status, dateTime, qs, roleLabel, ticketStatuses } from "@/components/flexa/admin/admin-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Card } from "@/components/flexa/ui";
import { useApi } from "@/lib/api";

type Ticket = {
  id: string;
  code: string;
  category: string;
  subject: string;
  status: string;
  updatedAt: string;
  user: { name: string; role: string };
  _count: { messages: number };
};

export default function Support() {
  const [status, setStatus] = useState("");
  const state = useApi<Ticket[]>(`/support/tickets${qs({ status })}`);
  return (
    <>
      <PageHeader title="Soporte" sub="Solicitudes de trabajadores y empresas. Las más recientes primero." />
      <Labeled label="Estado" className="self-start">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-48">
          <option value="">Todas</option>
          {ticketStatuses.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Labeled>
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay solicitudes de soporte con este filtro.">
        {(rows) => (
          <Card className="p-4">
            <Table>
              <thead>
                <tr>
                  <Th>Solicitud</Th>
                  <Th>Categoría</Th>
                  <Th>Solicitante</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Mensajes</Th>
                  <Th>Actualizada</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-mint-1/60">
                    <Td>
                      <Link href={`/admin/soporte/${t.id}`} className="flex flex-col leading-tight hover:text-green-700">
                        <span className="max-w-[340px] truncate font-bold">{t.subject}</span>
                        <span className="text-xs font-semibold text-ink-3">{t.code}</span>
                      </Link>
                    </Td>
                    <Td className="text-ink-2">{t.category}</Td>
                    <Td>
                      {t.user.name} <span className="text-[13px] text-ink-3">· {roleLabel[t.user.role] ?? t.user.role}</span>
                    </Td>
                    <Td>
                      <Status value={t.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{t._count.messages}</Td>
                    <Td className="text-[13px] text-ink-2">{dateTime(t.updatedAt)}</Td>
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
