"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, Lightbulb, Receipt as ReceiptIcon, Wallet } from "@/components/flexa/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";
import { EmptyState, ErrorState, LoadingCards, Notice, Skeleton } from "@/components/flexa/worker/states";
import { Timeline } from "@/components/flexa/worker/timeline";
import { accountTypeLabel, statusOf, type Account, type Advance, type Earnings, type Simulation } from "@/components/flexa/worker/types";
import { Badge, Button, ButtonLink, Card, IconBox } from "@/components/flexa/ui";
import { api, ApiError, dateFmt, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Withdraw() {
  const reduce = useReducedMotion();
  const earnings = useApi<Earnings>("/worker/earnings");
  const accounts = useApi<Account[]>("/worker/accounts");
  const [amount, setAmount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [ackWarnings, setAckWarnings] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<Advance | null>(null);

  // Live simulation, debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!amount) return;
    let alive = true;
    const t = setTimeout(() => {
      setSimulating(true);
      api<Simulation>("/worker/simulate", { body: { amount } })
        .then((s) => alive && (setSim(s), setSimError(null)))
        .catch((e) => alive && setSimError(e instanceof ApiError ? e.message : "No pudimos simular el retiro."))
        .finally(() => alive && setSimulating(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [amount]);

  const e = earnings.data;
  const list = accounts.data ?? [];
  const accountId = picked ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null;
  const current = sim && sim.amount === amount ? sim : null;
  const ready = !!current?.valid && !!accountId && !simulating && !!e?.canRequest;
  const pct = e?.available ? Math.min(amount / e.available, 1) : 0;
  const over = current ? !current.valid : false;
  const high = !!current?.overRecommended && !over;

  const send = async (acknowledge: boolean) => {
    setSending(true);
    setSendError(null);
    try {
      const created = await api<Advance>("/worker/advances", { body: { amount, bankAccountId: accountId, ...(acknowledge ? { acknowledgeWarnings: true } : {}) } });
      setAckWarnings(null);
      setDone(created.events ? created : await api<Advance>(`/worker/advances/${created.id}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body.code === "ACK_REQUIRED") setAckWarnings(err.body.warnings ?? current?.warnings ?? []);
      else {
        setAckWarnings(null);
        setSendError(err instanceof ApiError ? err.message : "No pudimos enviar tu solicitud.");
      }
    } finally {
      setSending(false);
    }
  };

  if (done) return <Result advance={done} />;

  const chip = (active: boolean) =>
    cn(
      "h-10 rounded-full px-1 text-[13px] font-bold tabular-nums transition-[background-color,transform] duration-150 active:scale-[0.97]",
      active ? "bg-btn-primary text-white shadow-btn" : "bg-surface text-ink shadow-sm ring-1 ring-line hover:bg-green-50",
    );

  const quick = e ? [...new Set([e.recommended, 50_000, 100_000].filter((q) => q >= e.limits.minAmount && q <= e.available))].slice(0, 3) : [];

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Retirar" />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-40">
        {earnings.error ? (
          <ErrorState error={earnings.error} onRetry={earnings.reload} title="No pudimos consultar tu disponible" />
        ) : (
          <Card tone="mint" className="flex items-center gap-4 p-5">
            <IconBox tone="dark" size="lg" className="shadow-[0_8px_18px_-8px_rgb(20_61_34/0.6)]">
              <Wallet className="stroke-[2.5]" />
            </IconBox>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-green-900">Saldo disponible</span>
              {e ? (
                <span className="text-[28px] leading-tight font-extrabold tracking-[-0.03em] text-ink tabular-nums">{money(e.available)}</span>
              ) : (
                <Skeleton className="h-8 w-36" />
              )}
              {e && <span className="text-[13px] font-semibold text-green-900">Recomendado {money(e.recommended)}</span>}
            </span>
          </Card>
        )}

        {e && e.blockers.length > 0 && (
          <Notice tone="warning" title="Por ahora no puedes retirar">
            {e.blockers.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </Notice>
        )}

        <Card className="flex flex-col gap-4 p-5">
          <label htmlFor="amount" className="text-h3 text-ink">
            ¿Cuánto quieres retirar?
          </label>
          <div
            className={cn(
              "flex items-center gap-1 rounded-md bg-page px-4 py-2 ring-[1.5px] transition-[box-shadow] duration-150 focus-within:ring-[2px]",
              over ? "ring-danger" : high ? "ring-warning-icon" : "ring-line focus-within:ring-green-500",
            )}
          >
            <span className="text-[32px] font-extrabold text-green-600">$</span>
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              value={amount ? amount.toLocaleString("es-CO") : ""}
              placeholder="0"
              disabled={!e?.canRequest}
              onChange={(ev) => setAmount(Number(ev.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
              aria-invalid={over}
              aria-describedby="amount-help"
              className="h-14 w-full bg-transparent text-[40px] font-extrabold tracking-[-0.03em] text-ink tabular-nums outline-none placeholder:text-ink-3 disabled:opacity-50"
              style={{ outline: "none" }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="relative h-2 overflow-hidden rounded-full bg-green-100">
              <motion.div
                className={cn("h-full rounded-full", over ? "bg-danger" : high ? "bg-warning-icon" : "bg-linear-to-r from-green-400 to-green-600")}
                animate={{ width: `${pct * 100}%` }}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.5, bounce: 0 }}
              />
              {e && e.available > 0 && (
                <span aria-hidden className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${Math.min(e.recommended / e.available, 1) * 100}%` }} title="Recomendado" />
              )}
            </div>
            <p id="amount-help" aria-live="polite" className={cn("text-[13px]", over ? "font-bold text-danger" : high ? "font-semibold text-warning" : "font-medium text-ink-2")}>
              {simError
                ? simError
                : current?.errors.length
                  ? current.errors[0]
                  : high
                    ? `Supera el recomendado de ${money(current!.recommended)}.`
                    : e
                      ? `Mínimo ${money(e.limits.minAmount)}, máximo ${money(Math.min(e.available, e.limits.maxAmountPerRequest))}. La línea marca el recomendado.`
                      : " "}
            </p>
          </div>

          {e && e.available > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {quick.map((q) => (
                <button key={q} type="button" onClick={() => setAmount(q)} className={chip(amount === q)}>
                  {money(q)}
                </button>
              ))}
              <button type="button" onClick={() => setAmount(e.available)} className={chip(amount === e.available)}>
                Todo
              </button>
            </div>
          )}
        </Card>

        <Card tone="soft" className="flex flex-col gap-3 p-5">
          <h2 className="text-h3 text-ink">¿A dónde lo enviamos?</h2>
          {accounts.loading && !accounts.data ? (
            <LoadingCards count={1} />
          ) : accounts.error ? (
            <ErrorState error={accounts.error} onRetry={accounts.reload} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No tienes cuentas registradas"
              text="Agrega una cuenta a tu nombre para recibir tus retiros."
              action={
                <ButtonLink href="/app/perfil?vista=cuentas" size="sm">
                  Agregar cuenta
                </ButtonLink>
              }
            />
          ) : (
            <div role="radiogroup" aria-label="Cuenta de destino" className="flex flex-col gap-2">
              {list.map((a) => {
                const active = a.id === accountId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPicked(a.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md bg-surface p-3 text-left ring-inset transition-[box-shadow,background-color] duration-150",
                      active ? "bg-green-50 ring-2 ring-green-500" : "shadow-xs ring-1 ring-line hover:bg-green-50/60",
                    )}
                  >
                    <IconBox size="sm" tone={active ? "dark" : "green"}>
                      <Building2 />
                    </IconBox>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-bold text-ink">{a.bank}</span>
                      <span className="text-[13px] font-medium text-ink-3 tabular-nums">
                        {accountTypeLabel[a.type]} · {a.number}
                      </span>
                    </span>
                    {active && <Check weight="bold" className="size-5 text-green-600" />}
                  </button>
                );
              })}
              <Link href="/app/perfil?vista=cuentas" className="self-start text-sm font-bold text-green-700 underline-offset-4 hover:underline">
                Gestionar cuentas
              </Link>
            </div>
          )}
        </Card>

        <Card tone="soft" className="p-5" aria-busy={simulating}>
          <dl className={cn("flex flex-col gap-3 text-sm transition-opacity", simulating && "opacity-60")}>
            <Row label="Recibes" value={money(current?.youReceive ?? 0)} strong />
            <Row label="Costo del retiro" value={current ? (current.fee ? money(current.fee) : "Sin costo") : "—"} />
            <Row label="Se descuenta de tu nómina" value={money(current?.toDiscountFromPayroll ?? 0)} />
            <div className="flex flex-col gap-3 border-t border-line-soft pt-3">
              <Row label={`Tu pago del ${current?.payDate ? dateFmt(current.payDate, { day: "numeric", month: "short" }) : e?.period ? dateFmt(e.period.payDate, { day: "numeric", month: "short" }) : "—"}`} value={current ? `${money(current.nextPayBefore)} → ${money(current.nextPayAfter)}` : e ? money(e.nextPayAfterUsage) : "—"} />
              <Row label="Uso de tu tope" value={current ? `${current.usagePctAfter}%` : e ? `${e.usagePct}%` : "—"} />
            </div>
          </dl>
          {current && current.warnings.length > 0 && current.valid && (
            <Notice tone="warning" className="mt-4" title="Ten en cuenta">
              {current.warnings.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </Notice>
          )}
          {current && !current.overRecommended && current.valid && (
            <p className="mt-4 flex items-center gap-2 text-[13px] font-bold text-green-700">
              <Check weight="bold" className="size-4" />
              Está dentro de tu monto recomendado.
            </p>
          )}
        </Card>

        {sendError && <Notice tone="error">{sendError}</Notice>}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] bg-linear-to-t from-page from-60% to-page/0 px-5 pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button className="w-full" disabled={!ready || sending} onClick={() => send(false)}>
          {sending ? "Enviando..." : amount && current?.valid ? `Retirar ${money(amount)}` : "Continuar"}
        </Button>
      </div>

      <AnimatePresence>
        {ackWarnings && (
          <AckWarning amount={amount} recommended={current?.recommended ?? e?.recommended ?? 0} warnings={ackWarnings} busy={sending} onConfirm={() => send(true)} onClose={() => setAckWarnings(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-medium text-ink-2">{label}</dt>
      <dd className={cn("text-right tabular-nums", strong ? "text-base font-extrabold text-ink" : "font-bold text-ink")}>{value}</dd>
    </div>
  );
}

// Full-screen safety moment (mockup screen 10): the API asks the worker to acknowledge
// the warnings explicitly before the request is created.
function AckWarning({
  amount,
  recommended,
  warnings,
  busy,
  onConfirm,
  onClose,
}: {
  amount: number;
  recommended: number;
  warnings: string[];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLInputElement>(null);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="warn-title"
      aria-describedby="warn-text"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: reduce ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 mx-auto isolate flex max-w-[430px] flex-col overflow-y-auto bg-warning-screen px-6 pt-[max(48px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]"
    >
      <Backdrop variant="warning" />
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-24 place-items-center rounded-full bg-white/55 shadow-[0_16px_40px_-16px_rgb(201_61_61/0.45)] ring-8 ring-white/30">
          <svg viewBox="0 0 24 24" className="size-14 drop-shadow-[0_4px_8px_rgb(201_61_61/0.35)]" aria-hidden>
            <path d="M10.3 3.9a2 2 0 0 1 3.4 0l8.3 14.4a2 2 0 0 1-1.7 3H3.7a2 2 0 0 1-1.7-3z" fill="#e04848" />
            <path d="M12 9v5" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={12} cy={17.3} r={1.35} fill="#fff" />
          </svg>
        </span>
        <h2 id="warn-title" className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-danger">
          ¡Atención!
        </h2>
        <p id="warn-text" className="max-w-[26ch] text-lg leading-snug font-bold text-balance text-ink">
          Antes de retirar {money(amount)}, revisa esto:
        </p>
      </div>

      <Card className="mt-6 flex flex-col gap-3 p-4">
        <ul className="flex flex-col gap-2.5">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2.5 text-sm font-medium text-ink">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
              {w}
            </li>
          ))}
        </ul>
        {amount > recommended && recommended > 0 && (
          <div className="flex items-start gap-3 border-t border-line-soft pt-3">
            <IconBox tone="amber" size="sm">
              <Lightbulb />
            </IconBox>
            <span className="text-sm font-medium text-ink-2">Considera retirar {money(recommended)} o menos para proteger tu próximo pago.</span>
          </div>
        )}
      </Card>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md bg-white/70 p-4 text-sm font-semibold text-ink ring-1 ring-white">
        <input ref={box} type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#c93d3d]" />
        Leí las advertencias y entiendo que este valor se descontará de mi próximo pago de nómina.
      </label>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Button variant="danger" onClick={onConfirm} disabled={!ack || busy}>
          {busy ? "Enviando..." : "Entiendo y continuar"}
        </Button>
        <Button variant="danger-outline" onClick={onClose} disabled={busy}>
          Modificar monto
        </Button>
      </div>
    </motion.div>
  );
}

function Result({ advance: a }: { advance: Advance }) {
  const st = statusOf(a.status);
  const paid = a.status === "DISBURSED";
  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Tu retiro" />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-10">
        <Card tone={paid ? "mint" : a.status === "FAILED" ? "red" : "amber"} className="flex flex-col items-center gap-2 p-6 text-center">
          <span className="text-sm font-semibold text-ink-2">Solicitud {a.code}</span>
          <span className="text-display text-ink tabular-nums">{money(a.amount)}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
          <p className="mt-1 max-w-[30ch] text-sm font-medium text-ink-2">
            {paid
              ? `Enviado a ${a.bankAccount.bank} ${a.bankAccount.number}.`
              : a.status === "EXCEPTION"
                ? "Por su monto, tu empresa debe aprobarla. Te avisaremos en la Alarma FLEXA."
                : a.status === "FAILED"
                  ? "La transferencia no pasó. Ya creamos una incidencia para reintentarla."
                  : "Estamos procesando tu solicitud."}
          </p>
        </Card>
        <Card tone="soft" className="flex flex-col gap-4 p-5">
          <h2 className="text-h3 text-ink">Estado</h2>
          <Timeline events={a.events ?? []} status={a.status} />
        </Card>
        <div className="flex flex-col gap-2">
          {paid ? (
            <ButtonLink href={`/app/comprobante/${a.code}?nuevo=1`}>
              <ReceiptIcon />
              Ver comprobante
            </ButtonLink>
          ) : (
            <ButtonLink href={`/app/solicitudes/${a.id}`}>Ver solicitud</ButtonLink>
          )}
          <ButtonLink href="/app" variant="ghost">
            Volver al inicio
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
