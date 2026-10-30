"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, House, Share2 } from "@/components/flexa/icons";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";
import { Badge, Button, ButtonLink, Card } from "@/components/flexa/ui";
import { money } from "@/lib/mock";

// `ref` is reserved in React 19, so the receipt code travels as `reference`.
type Props = { amount: number; dest: string; account: string; when: string; reference: string; fresh: boolean };

export function Receipt({ amount, dest, account, when, reference, fresh }: Props) {
  const reduce = useReducedMotion();
  const animate = fresh && !reduce;
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `Comprobante Flexa ${reference}: ${money(amount)} a ${dest}, cuenta ${account}.`;
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
    ["Referencia", reference],
  ];

  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Comprobante" back={fresh ? "/app" : "/app/movimientos"} />
      <main className="flex flex-col gap-6 px-5 pt-5 pb-10">
        <section className="flex flex-col items-center gap-5 text-center">
          <motion.span
            initial={animate ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="grid size-[72px] place-items-center rounded-full bg-[#ddf0d8] shadow-[0_10px_24px_-10px_rgb(43_127_64/0.5)] ring-8 ring-mint-1"
          >
            <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="var(--color-green-600)" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={animate ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </motion.span>
          <div className="flex flex-col gap-1">
            <h2 className="text-h2 text-ink">{fresh ? "¡Transferencia exitosa!" : "Retiro realizado"}</h2>
            <p className="text-[15px] font-medium text-ink-2">{fresh ? "Tu dinero ya está en camino." : "Este es el detalle de tu movimiento."}</p>
          </div>
        </section>

        <Card tone="soft" className="overflow-hidden">
          <div className="flex flex-col items-center gap-2 px-5 pt-6 pb-5">
            <span className="text-sm font-semibold text-ink-2">Monto</span>
            <span className="text-display text-ink tabular-nums">{money(amount)}</span>
            <Badge>
              <Check className="mr-1 size-3.5 stroke-[3]" />
              Aprobado
            </Badge>
          </div>
          {/* ticket perforation: dashed rule between two notches cut by the page color */}
          <div aria-hidden className="relative h-0 border-t-2 border-dashed border-line">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-page" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-page" />
          </div>
          <dl className="flex flex-col px-5 py-2">
            {rows.map(([k, v], i) => (
              <div key={k} className={`flex min-h-12 items-center justify-between gap-4 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                <dt className="text-sm font-medium text-ink-2">{k}</dt>
                <dd className="text-right text-sm font-bold text-ink tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="flex flex-col gap-2">
          <Button variant="soft" onClick={share}>
            {copied ? <Check /> : <Share2 />}
            {copied ? "Copiado" : "Compartir comprobante"}
          </Button>
          <ButtonLink href="/app" variant="ghost">
            <House />
            Volver al inicio
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
