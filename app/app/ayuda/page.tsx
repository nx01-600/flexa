"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, CircleHelp, MessageCircle, Plus, Search, X } from "@/components/flexa/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { Choice } from "@/components/flexa/choice";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { useSignedIn } from "@/components/flexa/worker/guard";
import { EmptyState, ErrorState, LoadingRows, Notice } from "@/components/flexa/worker/states";
import { ticketStatus, type Advance, type Ticket } from "@/components/flexa/worker/types";
import { Badge, Button, ButtonLink, Card, Field, IconBox, Input } from "@/components/flexa/ui";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError, dateFmt, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const faqs = [
  { q: "¿Cuánto puedo retirar?", a: "Un porcentaje de lo que ya trabajaste en el periodo, según las reglas de tu empresa. Lo ves en Inicio como «Disponible para retirar», y en Mi salario el cálculo paso a paso." },
  { q: "¿Cómo se paga lo que retiro?", a: "Se descuenta automáticamente de tu siguiente pago de nómina. No tienes que hacer nada." },
  { q: "¿Es un préstamo?", a: "No. Es tu propio salario, que ya ganaste, entregado antes de la fecha de pago." },
  { q: "¿Qué es el monto recomendado?", a: "Una referencia para que tu próximo pago no se reduzca demasiado. Puedes retirar más, hasta tu disponible, pero te pediremos confirmar." },
  { q: "¿Por qué mi solicitud está en revisión?", a: "Los montos altos los aprueba Talento Humano antes del desembolso. Te avisamos en la Alarma FLEXA cuando cambie el estado." },
];

// Accent- and case-insensitive match for the FAQ search.
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Módulo 10: FAQ plus the worker's support tickets.
export default function Help() {
  const signedIn = useSignedIn();
  const [query, setQuery] = useState("");
  const list = faqs.filter(({ q, a }) => norm(q + a).includes(norm(query)));

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Ayuda" back={signedIn === false ? "/app/login" : "/app"} />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-10">
        <Card tone="mint" className="relative isolate flex flex-col gap-4 overflow-hidden p-5">
          <Blob shape={0} tone="deep" className="-top-16 -right-16 -z-10 size-48 opacity-70" />
          <IconBox tone="solid" size="lg">
            <CircleHelp className="stroke-[2.5]" />
          </IconBox>
          <div className="flex flex-col gap-1">
            <h2 className="text-h2 text-ink">¿En qué te ayudamos?</h2>
            <p className="text-sm font-medium text-green-900">Encuentra respuestas rápidas o escríbenos.</p>
          </div>
          <label htmlFor="faq-search" className="sr-only">
            Buscar en preguntas frecuentes
          </label>
          <Input id="faq-search" icon={Search} type="search" placeholder="Busca tu pregunta" value={query} onChange={(e) => setQuery(e.target.value)} className="border-0 shadow-sm" />
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">Preguntas frecuentes</h2>
          <Card tone="soft" className="overflow-hidden">
            {list.map(({ q, a }, i) => (
              <details key={q} className={`group px-4 [&_summary::-webkit-details-marker]:hidden ${i > 0 ? "border-t border-line-soft" : ""}`}>
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink">
                  {q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green-100 text-green-700 transition-[transform,background-color] duration-200 group-open:rotate-45 group-open:bg-green-200">
                    <Plus className="size-[18px] stroke-[2.5]" />
                  </span>
                </summary>
                <p className="pb-4 text-sm font-medium text-ink-2">{a}</p>
              </details>
            ))}
            {list.length === 0 && <p className="p-5 text-center text-sm font-medium text-ink-2">No encontramos preguntas con «{query}». Escríbenos y te ayudamos.</p>}
          </Card>
        </section>

        {signedIn ? (
          <Tickets />
        ) : signedIn === false ? (
          <EmptyState
            icon={MessageCircle}
            title="¿Necesitas hablar con nosotros?"
            text="Inicia sesión para crear una solicitud de soporte y ver sus respuestas."
            action={
              <ButtonLink href="/app/login" size="sm">
                Iniciar sesión
              </ButtonLink>
            }
          />
        ) : null}
      </main>
    </>
  );
}

function Tickets() {
  const router = useRouter();
  const tickets = useApi<Ticket[]>("/support/tickets");
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3 text-ink">Mis solicitudes</h2>
        <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
          <Plus />
          Nueva
        </Button>
      </div>
      {tickets.loading && !tickets.data ? (
        <LoadingRows count={2} />
      ) : tickets.error ? (
        <ErrorState error={tickets.error} onRetry={tickets.reload} />
      ) : !tickets.data?.length ? (
        <EmptyState icon={MessageCircle} title="No tienes solicitudes" text="Si algo no salió como esperabas, escríbenos y te respondemos aquí mismo." />
      ) : (
        <Card tone="soft" className="overflow-hidden">
          {tickets.data.map((t, i) => {
            const st = ticketStatus[t.status] ?? ticketStatus.OPEN;
            return (
              <Link key={t.id} href={`/app/ayuda/${t.id}`} className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70">
                <IconBox size="sm" tone={t.status === "WAITING_USER" ? "solid" : "green"}>
                  <MessageCircle />
                </IconBox>
                <span className={cn("flex min-h-[68px] min-w-0 flex-1 items-center gap-2 py-2 pr-3", i > 0 && "border-t border-line-soft")}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold text-ink">{t.subject}</span>
                    <span className="truncate text-[13px] font-medium text-ink-3">
                      {t.category} · {dateFmt(t.updatedAt, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <Badge tone={st.tone} className="h-6 px-2.5">
                    {st.label}
                  </Badge>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                </span>
              </Link>
            );
          })}
        </Card>
      )}
      <NewTicket open={open} onOpenChange={setOpen} onCreated={(t) => router.push(`/app/ayuda/${t.id}`)} />
    </section>
  );
}

const NO_ADVANCE = "Ninguna";

function NewTicket({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (t: Ticket) => void }) {
  const categories = useApi<string[]>(open ? "/support/categories" : null);
  const advances = useApi<Advance[]>(open ? "/worker/advances" : null);
  const [category, setCategory] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [advance, setAdvance] = useState<string>(NO_ADVANCE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advLabel = (a: Advance) => `${a.code} · ${money(a.amount)} · ${dateFmt(a.createdAt, { day: "numeric", month: "short" })}`;
  const valid = !!category && subject.trim().length >= 3 && description.trim().length >= 5;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const advanceId = advances.data?.find((a) => advLabel(a) === advance)?.id;
      const t = await api<Ticket>("/support/tickets", { body: { category, subject: subject.trim(), description: description.trim(), ...(advanceId ? { advanceId } : {}) } });
      onCreated(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la solicitud.");
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-h-[92dvh] max-w-[430px] gap-0 overflow-y-auto rounded-t-2xl border-0 bg-page p-0 md:data-[side=bottom]:bottom-6 md:max-h-[calc(100dvh-3rem)] md:max-w-[520px] md:rounded-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4 px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-0.5">
              <SheetTitle className="text-h3 font-bold text-ink">Nueva solicitud</SheetTitle>
              <SheetDescription className="text-[13px] font-medium text-ink-2">Te respondemos en esta misma conversación.</SheetDescription>
            </div>
            <SheetClose aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-black/[0.03]">
              <X weight="bold" className="size-5" />
            </SheetClose>
          </div>
          {categories.error && <Notice tone="error">{categories.error.message}</Notice>}
          <Field label="Tema" htmlFor="tk-cat">
            <Choice id="tk-cat" options={categories.data ?? []} value={category} onChange={setCategory} placeholder={categories.loading ? "Cargando..." : "Selecciona un tema"} className="data-[size=default]:h-13" />
          </Field>
          <Field label="Asunto" htmlFor="tk-subject">
            <Input id="tk-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="Ej.: No me llegó el retiro" />
          </Field>
          <Field label="Cuéntanos qué pasó" htmlFor="tk-desc">
            <textarea
              id="tk-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border-[1.5px] border-input bg-surface px-4 py-3 text-base font-medium text-ink shadow-xs transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-ink-3 focus:border-green-500 focus:ring-4 focus:ring-green-200/70"
            />
          </Field>
          {!!advances.data?.length && (
            <Field label="Relacionar con un retiro (opcional)" htmlFor="tk-adv">
              <Choice id="tk-adv" options={[NO_ADVANCE, ...advances.data.slice(0, 15).map(advLabel)]} value={advance} onChange={setAdvance} className="data-[size=default]:h-13" />
            </Field>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" disabled={!valid || busy}>
            {busy ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
