"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Lightbulb, TriangleAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Choice } from "@/components/flexa/choice";
import { Button, Field, Input } from "@/components/flexa/ui";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { banks, money, worker } from "@/lib/mock";
import { cn } from "@/lib/utils";

// ponytail: fixed threshold; the real rule (by profile and upcoming expenses) is pending from Flexa.
const HIGH = 200_000;
const quick = [50_000, 100_000, 200_000];

export default function Withdraw() {
  const router = useRouter();
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

  return (
    <>
      <TopBar title="Retirar" />
      <main className="flex flex-col gap-6 px-5 pt-1 pb-32">
        <section className="flex items-center gap-3 rounded-lg bg-green-100 p-4">
          <span className="grid size-11 place-items-center rounded-md bg-surface text-green-700">
            <Wallet className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-green-900/80">Saldo disponible</span>
            <span className="text-2xl font-extrabold text-ink tabular-nums">{money(worker.available)}</span>
          </span>
        </section>

        <section className="flex flex-col gap-3">
          <label htmlFor="amount" className="text-sm font-semibold text-ink">¿Cuánto quieres retirar?</label>
          <div
            className={cn(
              "flex items-baseline gap-1 border-b-2 pb-2 transition-colors",
              over ? "border-danger" : high ? "border-warning-icon" : "border-green-500",
            )}
          >
            <span className="text-3xl font-extrabold text-ink-3">$</span>
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              value={amount ? amount.toLocaleString("es-CO") : ""}
              placeholder="0"
              onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
              aria-invalid={over}
              aria-describedby="amount-help"
              className="w-full bg-transparent text-4xl font-extrabold tracking-[-0.02em] text-ink tabular-nums outline-none placeholder:text-ink-3/60"
            />
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-green-100">
            <motion.div
              className={cn("h-full rounded-full", over ? "bg-danger" : high ? "bg-warning-icon" : "bg-green-500")}
              animate={{ width: `${pct * 100}%` }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
            />
          </div>
          <p id="amount-help" className={cn("text-sm", over ? "font-semibold text-danger" : "text-ink-2")}>
            {over
              ? `Supera tu disponible de ${money(worker.available)}.`
              : high
                ? "Es más de dos tercios de tu disponible."
                : `Mínimo $20.000, máximo ${money(worker.available)}.`}
          </p>

          <div className="grid grid-cols-4 gap-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={cn(
                  "h-9 rounded-full border px-1 text-[13px] font-semibold tabular-nums transition-colors active:scale-[0.97]",
                  amount === q ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface text-ink hover:bg-green-50",
                )}
              >
                {money(q)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(worker.available)}
              className={cn(
                "h-9 rounded-full border px-1 text-[13px] font-semibold transition-colors active:scale-[0.97]",
                amount === worker.available ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface text-ink hover:bg-green-50",
              )}
            >
              Todo
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink">¿A dónde lo enviamos?</h2>
          <Field label="Banco destinatario" htmlFor="bank">
            <Choice id="bank" options={banks} value={bank} onChange={setBank} placeholder="Selecciona un banco" />
          </Field>
          <Field label="Número de cuenta" htmlFor="account">
            <Input id="account" inputMode="numeric" placeholder="Ej. 123 456 7890" value={account} onChange={(e) => setAccount(e.target.value.replace(/[^\d ]/g, ""))} />
          </Field>
          <Field label="Tipo de cuenta" htmlFor="type">
            <Choice id="type" options={["Ahorros", "Corriente", "Depósito electrónico"]} value={type} onChange={setType} />
          </Field>
        </section>

        <dl className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-2">Recibes</dt><dd className="font-bold text-ink tabular-nums">{money(over ? 0 : amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">Costo del retiro</dt><dd className="font-semibold text-ink-3">Por definir</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">Se descuenta en</dt><dd className="font-semibold text-ink">Nómina del 15 nov</dd></div>
        </dl>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-green-50/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <Button className="w-full" disabled={!valid} onClick={() => (amount > HIGH ? setWarn(true) : confirm())}>
          Continuar
        </Button>
      </div>

      <Sheet open={warn} onOpenChange={setWarn}>
        <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-w-[430px] gap-0 rounded-t-xl border-0 px-5 pt-3 pb-6">
          <span aria-hidden className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />
          <span className="mb-4 grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
            <TriangleAlert className="size-7" />
          </span>
          <SheetTitle className="text-2xl font-extrabold text-ink">Este retiro podría afectar tu liquidez</SheetTitle>
          <SheetDescription className="mt-2 text-[15px] text-ink-2">
            Si retiras {money(amount)}, es posible que tengas menos dinero para tus gastos esenciales en los próximos días.
          </SheetDescription>
          <div className="mt-5 flex gap-3 rounded-md bg-warning-soft p-4">
            <Lightbulb className="size-5 shrink-0 text-warning-icon" />
            <p className="text-sm text-ink">
              <strong className="font-bold">Recomendación:</strong> considera un monto menor, por ejemplo {money(HIGH)}, para mantener un buen equilibrio.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="danger" onClick={confirm}>Entiendo y continuar</Button>
            <Button variant="outline" onClick={() => setWarn(false)}>Modificar monto</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
