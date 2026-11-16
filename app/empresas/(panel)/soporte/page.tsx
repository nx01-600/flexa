"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare, Plus } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { dateTime, Dialog, EmptyState, ErrorState, FormField, Loading, Notice, roleLabel, SectionCard, Select, TextArea, TextInput, TicketBadge, ticketStatus, useAction } from "@/components/flexa/empresas/kit";
import type { Ticket } from "@/components/flexa/empresas/types";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button } from "@/components/flexa/ui";
import { api, useApi } from "@/lib/api";

export default function Support() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi<Ticket[]>(`/support/tickets${status ? `?status=${status}` : ""}`);
  const categories = useApi<string[]>("/support/categories");
  const [open, setOpen] = useState(false);
  const { busy, error: e2, run } = useAction();
  return (
    <>
      <PageHeader title="Soporte" sub="Solicitudes de tu empresa y de tus trabajadores al equipo de Flexa." action={<Button size="md" onClick={() => setOpen(true)}><Plus />Nueva solicitud</Button>} />
      <SectionCard>
        <div className="flex justify-end">
          <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} options={Object.entries(ticketStatus).map(([value, [label]]) => ({ value, label }))} placeholder="Todos los estados" className="w-56" />
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading rows={4} />
        ) : !data?.length ? (
          <EmptyState icon={MessageSquare} title="Sin solicitudes" text="Si tienes una duda o un problema con la operación, escríbenos." />
        ) : (
          <Table>
            <thead><tr><Th>Código</Th><Th>Asunto</Th><Th>Categoría</Th><Th>Creada por</Th><Th>Actualizada</Th><Th className="text-right">Mensajes</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-mint-1">
                  <Td><Link href={`/empresas/soporte/${t.id}`} className="font-bold text-green-700 hover:underline">{t.code}</Link></Td>
                  <Td className="max-w-80 truncate font-bold">{t.subject}</Td>
                  <Td className="text-ink-2">{t.category}</Td>
                  <Td className="text-ink-2">{t.user.name} <span className="text-ink-3">· {roleLabel[t.user.role] ?? t.user.role}</span></Td>
                  <Td className="text-ink-2">{dateTime(t.updatedAt)}</Td>
                  <Td className="text-right tabular-nums">{t._count?.messages ?? 0}</Td>
                  <Td><TicketBadge value={t.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva solicitud de soporte"
        onSubmit={async (e) => {
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          const t = await run(() => api<Ticket>("/support/tickets", { body: f }));
          if (t) router.push(`/empresas/soporte/${t.id}`);
        }}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</Button>
          </>
        }
      >
        <FormField label="Categoría"><Select name="category" required options={(categories.data ?? []).map((c) => ({ value: c, label: c }))} /></FormField>
        <FormField label="Asunto"><TextInput name="subject" required minLength={3} /></FormField>
        <FormField label="Describe lo que pasa"><TextArea name="description" required minLength={5} /></FormField>
        {e2 && <Notice tone="red">{e2}</Notice>}
      </Dialog>
    </>
  );
}
