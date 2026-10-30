"use client";

import { motion } from "motion/react";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Button, ButtonLink } from "@/components/flexa/ui";
import { money } from "@/lib/mock";

type Props = { amount: number; dest: string; account: string; when: string; ref: string; fresh: boolean };

export function Receipt({ amount, dest, account, when, ref, fresh }: Props) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `Comprobante Flexa ${ref}: ${money(amount)} a ${dest}, cuenta ${account}.`;
    try {
      if (navigator.share) await navigator.share({ title: "Comprobante Flexa", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user closed the share sheet
    }
  };

  const rows = [
    ["Destino", dest],
    ["Número de cuenta", account],
    ["Fecha y hora", when],
    ["Referencia", ref],
  ];

  return (
    <>
      <TopBar title="Comprobante" back={fresh ? "/app" : "/app/movimientos"} />
      <main className="flex flex-col gap-6 px-5 pt-4 pb-8">
        <section className="flex flex-col items-center gap-4 text-center">
          <motion.span
            initial={fresh ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="grid size-20 place-items-center rounded-full bg-green-200"
          >
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="var(--color-green-700)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={fresh ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </motion.span>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-extrabold text-ink">{fresh ? "¡Transferencia exitosa!" : "Retiro realizado"}</h2>
            <p className="text-[15px] text-ink-2">{fresh ? "Tu dinero ya está en camino." : "Este es el detalle de tu movimiento."}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <div className="flex flex-col items-center gap-0.5 border-b border-dashed border-line bg-green-50/60 px-5 py-5">
            <span className="text-sm font-semibold text-ink-2">Monto</span>
            <span className="text-display font-extrabold text-ink tabular-nums">{money(amount)}</span>
          </div>
          <dl className="flex flex-col gap-3 px-5 py-5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-col gap-3">
          <Button variant="soft" onClick={share}>
            {copied ? <Check /> : <Share2 />}
            {copied ? "Copiado" : "Compartir comprobante"}
          </Button>
          <ButtonLink href="/app" variant="ghost">Volver al inicio</ButtonLink>
        </div>
      </main>
    </>
  );
}
