"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PaperPlaneRight } from "@/components/flexa/worker/icons";
import { ScreenFrame } from "@/components/flexa/worker/screen-frame";
import { ErrorState, LoadingCards, Notice } from "@/components/flexa/worker/states";
import { stamp, statusOf, ticketStatus, type Ticket } from "@/components/flexa/worker/types";
import { Badge, Button, Card } from "@/components/flexa/ui";
import { api, ApiError, getSession, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: t, error, loading, reload } = useApi<Ticket>(`/support/tickets/${encodeURIComponent(id)}`);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const me = getSession("worker")?.user.name;

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setSendError(null);
    try {
      await api(`/support/tickets/${id}/messages`, { body: { body: body.trim() } });
      setBody("");
      reload();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "No pudimos enviar tu mensaje.");
    } finally {
      setBusy(false);
    }
  };

  if (!t)
    return (
      <ScreenFrame title="Solicitud de soporte" back="/app/ayuda">
        {loading ? <LoadingCards count={2} label="Cargando conversación" /> : <ErrorState error={error} onRetry={reload} title="No encontramos esta solicitud" />}
      </ScreenFrame>
    );

  const st = ticketStatus[t.status] ?? ticketStatus.OPEN;
  const closed = t.status === "CLOSED";
  const thread = [{ id: "first", body: t.description, createdAt: t.createdAt, author: { name: me ?? "Tú", role: "WORKER" } }, ...(t.messages ?? [])];

  return (
    <ScreenFrame title="Solicitud de soporte" back="/app/ayuda">
      <Card tone="soft" className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-h3 text-ink">{t.subject}</h2>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <span className="text-[13px] font-medium text-ink-3">
          {t.code} · {t.category} · Abierta el {stamp(t.createdAt)}
        </span>
        {t.advance && (
          <Link href={`/app/solicitudes/${t.advanceId}`} className="mt-1 self-start rounded-sm bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-xs ring-1 ring-line hover:bg-green-50">
            Retiro {t.advance.code} · {money(t.advance.amount)} · {statusOf(t.advance.status).label}
          </Link>
        )}
      </Card>

      <ol className="flex flex-col gap-3" aria-label="Conversación">
        {thread.map((m) => {
          const mine = m.author.role === "WORKER";
          return (
            <li key={m.id} className={cn("flex max-w-[86%] flex-col gap-1", mine ? "self-end items-end" : "self-start")}>
              <span className="px-1 text-xs font-bold text-ink-3">{mine ? "Tú" : m.author.name}</span>
              <p className={cn("rounded-lg px-4 py-3 text-sm font-medium whitespace-pre-wrap", mine ? "rounded-br-sm bg-green-600 text-white" : "rounded-bl-sm bg-surface text-ink shadow-sm ring-1 ring-line")}>
                {m.body}
              </p>
              <span className="px-1 text-[11px] font-semibold text-ink-3 tabular-nums">{stamp(m.createdAt)}</span>
            </li>
          );
        })}
      </ol>

      {closed ? (
        <Notice tone="info">Esta solicitud está cerrada. Si necesitas algo más, crea una nueva desde Ayuda.</Notice>
      ) : (
        <form onSubmit={reply} className="flex flex-col gap-2">
          <label htmlFor="reply" className="sr-only">
            Escribe tu respuesta
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="reply"
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe tu respuesta"
              className="min-h-13 flex-1 resize-none rounded-md border-[1.5px] border-input bg-surface px-4 py-3 text-base font-medium text-ink shadow-xs outline-none placeholder:text-ink-3 focus:border-green-500 focus:ring-4 focus:ring-green-200/70"
            />
            <Button type="submit" size="lg" aria-label="Enviar" className="w-13 px-0" disabled={!body.trim() || busy}>
              <PaperPlaneRight weight="fill" />
            </Button>
          </div>
          {sendError && <Notice tone="error">{sendError}</Notice>}
        </form>
      )}
    </ScreenFrame>
  );
}
