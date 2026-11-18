"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Clock, House, Share2 } from "@/components/flexa/icons";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";
import { Badge, Button, ButtonLink, Card } from "@/components/flexa/ui";
import { stamp, statusOf, type ReceiptData } from "@/components/flexa/worker/types";
import { money } from "@/lib/api";

const kindLabel = { RETIRO: "Retiro", PAGO: "Pago de servicio", RECARGA: "Recarga" };

// `fresh` plays the success moment right after a confirmed operation.
export function Receipt({ data, fresh }: { data: ReceiptData; fresh: boolean }) {
  const reduce = useReducedMotion();
  const animate = fresh && !reduce;
  const [copied, setCopied] = useState(false);
  const done = data.status === "DISBURSED" || data.status === "COMPLETED";
  const st = statusOf(data.status);

  const share = async () => {
    const text = `Comprobante FLEXA ${data.code}: ${money(data.amount)} a ${data.destination}, ${stamp(data.date)}.`;
    try {
      if (navigator.share) await navigator.share({ title: "Comprobante FLEXA", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user closed the share sheet
    }
  };

  const rows: [string, string][] = [
    ["Tipo", kindLabel[data.kind] + (data.category ? ` · ${data.category}` : "")],
    ["Destino", data.destination],
    ["Fecha y hora", stamp(data.date)],
    ["Comisión", data.fee ? money(data.fee) : "Sin costo"],
    ["Recibes", money(data.received)],
    ["Referencia", data.code],
  ];
  if (data.providerRef) rows.push(["Ref. de transferencia", data.providerRef]);
  if (data.worker) rows.push(["Titular", `${data.worker}${data.doc ? ` · ${data.doc}` : ""}`]);
  if (data.company) rows.push(["Empresa", data.company]);

  const title = fresh ? (done ? (data.kind === "RETIRO" ? "¡Transferencia exitosa!" : "¡Pago realizado!") : "Solicitud recibida") : `${kindLabel[data.kind]} ${done ? "realizado" : st.label.toLowerCase()}`;

  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Comprobante" back={fresh ? "/app" : "/app/movimientos"} />
      <main className="flex flex-col gap-6 px-5 pt-5 pb-10 md:mx-auto md:max-w-[600px]">
        <section className="flex flex-col items-center gap-5 text-center">
          <motion.span
            initial={animate ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className={
              done
                ? "grid size-[72px] place-items-center rounded-full bg-[#ddf0d8] shadow-[0_10px_24px_-10px_rgb(43_127_64/0.5)] ring-8 ring-mint-1"
                : "grid size-[72px] place-items-center rounded-full bg-warning-soft text-warning-icon ring-8 ring-[#fff8e6]"
            }
          >
            {done ? (
              <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="var(--color-green-600)" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={animate ? { pathLength: 0 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
            ) : (
              <Clock weight="fill" className="size-9" />
            )}
          </motion.span>
          <div className="flex flex-col gap-1">
            <h2 className="text-h2 text-ink">{title}</h2>
            <p className="max-w-[32ch] text-[15px] font-medium text-ink-2">
              {data.note ?? (done ? "Este es el detalle de tu movimiento." : "Te avisaremos cuando cambie el estado.")}
            </p>
          </div>
        </section>

        <Card tone="soft" className="overflow-hidden">
          <div className="flex flex-col items-center gap-2 px-5 pt-6 pb-5">
            <span className="text-sm font-semibold text-ink-2">Monto</span>
            <span className="text-display text-ink tabular-nums">{money(data.amount)}</span>
            <Badge tone={st.tone}>
              {done && <Check className="mr-1 size-3.5 stroke-[3]" />}
              {st.label}
            </Badge>
          </div>
          {/* ticket perforation: dashed rule between two notches cut by the page color */}
          <div aria-hidden className="relative h-0 border-t-2 border-dashed border-line">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-page" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-page" />
          </div>
          <dl className="flex flex-col px-5 py-2">
            {rows.map(([k, v], i) => (
              <div key={k} className={`flex min-h-12 items-center justify-between gap-4 py-2 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                <dt className="shrink-0 text-sm font-medium text-ink-2">{k}</dt>
                <dd className="min-w-0 text-right text-sm font-bold break-words text-ink tabular-nums">{v}</dd>
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
