"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Building2, Lightbulb, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Choice } from "@/components/flexa/choice";
import { Backdrop } from "@/components/flexa/shapes";
import { Button, Card, Field, IconBox, Input } from "@/components/flexa/ui";
import { banks, money, worker } from "@/lib/mock";
import { cn } from "@/lib/utils";

// ponytail: fixed threshold; the real rule (by profile and upcoming expenses) is pending from Flexa.
const HIGH = 200_000;
const quick = [50_000, 100_000, 200_000];

export default function Withdraw() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [amount, setAmount] = useState(0);
  const [bank, setBank] = useState<string | null>(null);
  const [account, setAccount] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);

  const over = amount > worker.available;
  const high = amount > HIGH && !over;
  const pct = Math.min(amount / worker.available, 1);
  const valid = amount >= 20_000 && !over && bank && account.length >= 6 && type;

  const confirm = () => {
    const q = new URLSearchParams({ monto: String(amount), banco: bank!, cuenta: account });
    router.push(`/app/comprobante?${q}`);
  };

  const chip = (active: boolean) =>
    cn(
      "h-10 rounded-full px-1 text-[13px] font-bold tabular-nums transition-[background-color,transform] duration-150 active:scale-[0.97]",
      active ? "bg-btn-primary text-white shadow-btn" : "bg-surface text-ink shadow-sm ring-1 ring-line hover:bg-green-50",
    );

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Retirar" />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-40">
        <Card tone="mint" className="flex items-center gap-4 p-5">
          <IconBox tone="dark" size="lg" className="shadow-[0_8px_18px_-8px_rgb(20_61_34/0.6)]">
            <Wallet className="stroke-[2.5]" />
          </IconBox>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-green-900">Saldo disponible</span>
            <span className="text-[28px] leading-tight font-extrabold tracking-[-0.03em] text-ink tabular-nums">{money(worker.available)}</span>
          </span>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <label htmlFor="amount" className="text-h3 text-ink">¿Cuánto quieres retirar?</label>
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
              onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
              aria-invalid={over}
              aria-describedby="amount-help"
              className="h-14 w-full bg-transparent text-[40px] font-extrabold tracking-[-0.03em] text-ink tabular-nums outline-none placeholder:text-ink-3"
              style={{ outline: "none" }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-green-100">
              <motion.div
                className={cn("h-full rounded-full", over ? "bg-danger" : high ? "bg-warning-icon" : "bg-linear-to-r from-green-400 to-green-600")}
                animate={{ width: `${pct * 100}%` }}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.5, bounce: 0 }}
              />
            </div>
            <p id="amount-help" className={cn("text-[13px]", over ? "font-bold text-danger" : high ? "font-semibold text-warning" : "font-medium text-ink-2")}>
              {over
                ? `Supera tu disponible de ${money(worker.available)}.`
                : high
                  ? "Es más de dos tercios de tu disponible."
                  : `Mínimo $20.000, máximo ${money(worker.available)}.`}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => setAmount(q)} className={chip(amount === q)}>
                {money(q)}
              </button>
            ))}
            <button type="button" onClick={() => setAmount(worker.available)} className={chip(amount === worker.available)}>
              Todo
            </button>
          </div>
        </Card>

        <Card tone="soft" className="flex flex-col gap-4 p-5">
          <h2 className="text-h3 text-ink">Datos de la transferencia</h2>
          <Field label="Banco destinatario" htmlFor="bank">
            <Choice id="bank" options={banks} value={bank} onChange={setBank} placeholder="Selecciona un banco" icon={Building2} className="data-[size=default]:h-13" />
          </Field>
          <Field label="Número de cuenta" htmlFor="account">
            <Input id="account" inputMode="numeric" placeholder="Ingresa el número de cuenta" value={account} onChange={(e) => setAccount(e.target.value.replace(/[^\d ]/g, ""))} />
          </Field>
          <Field label="Tipo de cuenta" htmlFor="type">
            <Choice id="type" options={["Ahorros", "Corriente", "Depósito electrónico"]} value={type} onChange={setType} className="data-[size=default]:h-13" />
          </Field>
        </Card>

        <Card tone="soft" className="p-5">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between"><dt className="font-medium text-ink-2">Recibes</dt><dd className="text-base font-extrabold text-ink tabular-nums">{money(over ? 0 : amount)}</dd></div>
            <div className="flex justify-between"><dt className="font-medium text-ink-2">Costo del retiro</dt><dd className="font-semibold text-ink-2">Por definir</dd></div>
            <div className="flex justify-between border-t border-line-soft pt-3"><dt className="font-medium text-ink-2">Se descuenta en</dt><dd className="font-bold text-ink">Nómina del 15 nov</dd></div>
          </dl>
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] bg-linear-to-t from-page from-60% to-page/0 px-5 pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button className="w-full" disabled={!valid} onClick={() => (amount > HIGH ? setWarn(true) : confirm())}>
          Continuar
        </Button>
      </div>

      <AnimatePresence>
        {warn && <LiquidityWarning amount={amount} onConfirm={confirm} onClose={() => setWarn(false)} />}
      </AnimatePresence>
    </>
  );
}

// Full-screen safety moment (mockup screen 10), not a sheet: the choice deserves the whole screen.
function LiquidityWarning({ amount, onConfirm, onClose }: { amount: number; onConfirm: () => void; onClose: () => void }) {
  const reduce = useReducedMotion();
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus();
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
      className="fixed inset-0 z-50 mx-auto isolate flex max-w-[430px] flex-col overflow-y-auto bg-warning-screen px-6 pt-[max(64px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]"
    >
      <Backdrop variant="warning" />
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="grid size-28 place-items-center rounded-full bg-white/55 shadow-[0_16px_40px_-16px_rgb(201_61_61/0.45)] ring-8 ring-white/30">
          <svg viewBox="0 0 24 24" className="size-16 drop-shadow-[0_4px_8px_rgb(201_61_61/0.35)]" aria-hidden>
            <path d="M10.3 3.9a2 2 0 0 1 3.4 0l8.3 14.4a2 2 0 0 1-1.7 3H3.7a2 2 0 0 1-1.7-3z" fill="#e04848" />
            <path d="M12 9v5" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={12} cy={17.3} r={1.35} fill="#fff" />
          </svg>
        </span>
        <h2 id="warn-title" className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-danger">¡Atención!</h2>
        <p className="max-w-[22ch] text-xl leading-snug font-bold text-ink text-balance">Este retiro podría afectar tu liquidez futura.</p>
        <p id="warn-text" className="max-w-[32ch] text-[15px] font-medium text-ink-2">
          Si retiras {money(amount)}, es posible que tengas menos disponibilidad para tus gastos esenciales en los próximos días.
        </p>
      </div>

      <Card className="mt-7 flex items-start gap-3 p-4">
        <IconBox tone="amber">
          <Lightbulb />
        </IconBox>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold text-ink">Recomendación</span>
          <span className="text-sm font-medium text-ink-2">Considera un monto menor, por ejemplo {money(HIGH)}, para mantener un buen equilibrio financiero.</span>
        </div>
      </Card>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Button ref={primary} variant="danger" onClick={onConfirm}>Entiendo y continuar</Button>
        <Button variant="danger-outline" onClick={onClose}>Modificar monto</Button>
      </div>
    </motion.div>
  );
}
