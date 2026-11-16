"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Send } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { ConfirmDialog, dateTime, ErrorState, Notice, PageLoading, roleLabel, SectionCard, TextArea, TicketBadge, useAction, useCompanySession } from "@/components/flexa/empresas/kit";
import type { Ticket } from "@/components/flexa/empresas/types";
import { Avatar } from "@/components/flexa/empresas-ui";
import { Button } from "@/components/flexa/ui";
import { api, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const session = useCompanySession();
  const { data: t, error, loading, reload } = useApi<Ticket>(`/support/tickets/${id}`);
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState(false);
  const { busy, error: replyError, run } = useAction();

  if (loading && !t) return <PageLoading />;
  if (error || !t) return <ErrorState error={error} onRetry={reload} />;
  const closed = t.status === "CLOSED";
  const thread = [{ id: "first", body: t.description, createdAt: t.createdAt, author: t.user }, ...(t.messages ?? [])];

  return (
    <>
      <PageHeader
        back={{ href: "/empresas/soporte", label: "Soporte" }}
        title={t.subject}
        sub={`${t.code} · ${t.category} · abierta el ${dateTime(t.createdAt)}`}
        action={
          <>
            <TicketBadge value={t.status} />
            {!closed && <Button variant="outline" size="md" onClick={() => setClosing(true)}>Cerrar solicitud</Button>}
          </>
        }
      />
      {t.advance && <Notice tone="amber">Relacionada con la solicitud {t.advance.code} por {money(t.advance.amount)}.</Notice>}
      <SectionCard className="max-w-3xl">
        <ol className="flex flex-col gap-4">
          {thread.map((m) => {
            const flexa = m.author.role === "FLEXA_ADMIN";
            const mine = m.author.name === session?.user.name;
            return (
              <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                <Avatar name={m.author.name} />
                <div className={cn("flex max-w-[80%] flex-col gap-1 rounded-lg px-4 py-3", flexa ? "bg-mint-2" : mine ? "bg-green-100" : "bg-head")}>
                  <span className="text-[13px] font-bold text-ink">
                    {flexa ? "Equipo Flexa" : m.author.name}{" "}
                    <span className="font-semibold text-ink-3">· {flexa ? "" : `${roleLabel[m.author.role] ?? m.author.role} · `}{dateTime(m.createdAt)}</span>
                  </span>
                  <p className="text-[15px] font-medium whitespace-pre-wrap text-ink">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {closed ? (
          <Notice tone="amber">La solicitud está cerrada. Si necesitas algo más, crea una nueva.</Notice>
        ) : (
          <form
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!body.trim()) return;
              const ok = await run(() => api(`/support/tickets/${t.id}/messages`, { body: { body: body.trim() } }));
              if (ok) {
                setBody("");
                reload();
              }
            }}
          >
            <label className="sr-only" htmlFor="reply">Respuesta</label>
            <TextArea id="reply" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu respuesta" />
            {replyError && <Notice tone="red">{replyError}</Notice>}
            <div className="flex justify-end">
              <Button type="submit" size="md" disabled={busy || !body.trim()}><Send />{busy ? "Enviando…" : "Responder"}</Button>
            </div>
          </form>
        )}
      </SectionCard>
      <ConfirmDialog
        open={closing}
        onClose={() => setClosing(false)}
        title="Cerrar solicitud"
        text="Ya no se podrán agregar mensajes."
        confirm="Cerrar"
        onConfirm={async () => {
          await api(`/support/tickets/${t.id}/status`, { method: "PATCH", body: { status: "CLOSED" } });
          reload();
        }}
      />
    </>
  );
}
