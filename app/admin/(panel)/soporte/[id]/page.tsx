"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChevronLeft } from "@/components/flexa/icons";
import { Async, ErrorText, Labeled, PageHeader, Select, Status, Textarea, dateTime, roleLabel, ticketStatuses } from "@/components/flexa/admin/admin-ui";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Button, Card } from "@/components/flexa/ui";
import { api, ApiError, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  code: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string; role: string };
  advance: { code: string; amount: number; status: string } | null;
  messages: { id: string; body: string; createdAt: string; author: { name: string; role: string } }[];
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const state = useApi<Ticket>(`/support/tickets/${id}`);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"reply" | "status" | null>(null);
  const [error, setError] = useState("");

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy("reply");
    setError("");
    try {
      await api(`/support/tickets/${id}/messages`, { body: { body: reply.trim() } });
      setReply("");
      state.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la respuesta.");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: string) {
    setBusy("status");
    setError("");
    try {
      await api(`/support/tickets/${id}/status`, { method: "PATCH", body: { status } });
      state.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/admin/soporte" className="-mb-3 inline-flex items-center gap-1 self-start text-sm font-bold text-green-700 hover:text-green-900 [&_svg]:size-4">
        <ChevronLeft />
        Soporte
      </Link>
      <Async state={state}>
        {(t) => (
          <>
            <PageHeader title={t.subject} sub={`${t.code} · ${t.category} · abierta el ${dateTime(t.createdAt)}`} action={<Status value={t.status} />} />
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="flex flex-col gap-5 p-6">
                <CardHead title="Conversación" />
                <ol className="flex flex-col gap-3">
                  <li className="max-w-[85%] rounded-lg bg-mint-1 px-4 py-3">
                    <p className="text-[13px] font-bold text-ink-2">
                      {t.user.name} · {dateTime(t.createdAt)}
                    </p>
                    <p className="mt-1 text-[15px] font-medium whitespace-pre-line text-ink">{t.description}</p>
                  </li>
                  {t.messages.map((m) => {
                    const flexa = m.author.role === "FLEXA_ADMIN";
                    return (
                      <li key={m.id} className={cn("max-w-[85%] rounded-lg px-4 py-3", flexa ? "self-end bg-green-100" : "bg-mint-1")}>
                        <p className="text-[13px] font-bold text-ink-2">
                          {m.author.name}
                          {flexa && " (FLEXA)"} · {dateTime(m.createdAt)}
                        </p>
                        <p className="mt-1 text-[15px] font-medium whitespace-pre-line text-ink">{m.body}</p>
                      </li>
                    );
                  })}
                </ol>
                {t.status === "CLOSED" ? (
                  <p className="border-t border-line-soft pt-4 text-sm font-semibold text-ink-2">La solicitud está cerrada. Reábrela para responder.</p>
                ) : (
                  <form onSubmit={send} className="flex flex-col gap-3 border-t border-line-soft pt-4">
                    <Labeled label="Responder">
                      <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe la respuesta para el solicitante" />
                    </Labeled>
                    <p className="text-[13px] font-medium text-ink-3">Al responder, la solicitud pasa a «Esperando usuario».</p>
                    <Button type="submit" size="sm" disabled={!reply.trim() || !!busy} className="self-end">
                      {busy === "reply" ? "Enviando…" : "Enviar respuesta"}
                    </Button>
                  </form>
                )}
                <ErrorText>{error}</ErrorText>
              </Card>

              <Card className="flex flex-col gap-4 p-6">
                <CardHead title="Detalle" />
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="font-semibold text-ink-2">Solicitante</dt>
                    <dd className="font-bold text-ink">{t.user.name}</dd>
                    <dd className="font-medium break-all text-ink-2">{t.user.email}</dd>
                    <dd className="font-medium text-ink-2">{roleLabel[t.user.role] ?? t.user.role}</dd>
                  </div>
                  {t.advance && (
                    <div>
                      <dt className="font-semibold text-ink-2">Operación relacionada</dt>
                      <dd className="flex items-center gap-2 font-bold text-ink">
                        {t.advance.code} · {money(t.advance.amount)}
                      </dd>
                      <dd className="mt-1">
                        <Status value={t.advance.status} />
                      </dd>
                    </div>
                  )}
                </dl>
                <Labeled label="Estado de la solicitud">
                  <Select value={t.status} disabled={busy === "status"} onChange={(e) => changeStatus(e.target.value)}>
                    {ticketStatuses.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Labeled>
              </Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
