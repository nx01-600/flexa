"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Clock, X } from "@/components/flexa/icons";
import { stamp, statusOf, type AdvanceEvent } from "@/components/flexa/worker/types";
import { cn } from "@/lib/utils";

const BAD = ["FAILED", "REJECTED", "CANCELLED"];

// Vertical status timeline of an advance. When the money hasn't moved yet, a dimmed
// "Desembolso" step shows what comes next.
export function Timeline({ events, status }: { events: AdvanceEvent[]; status: string }) {
  const reduce = useReducedMotion();
  const pending = !["DISBURSED", ...BAD].includes(status);
  const steps = [
    ...events.map((e) => ({ key: e.id, label: statusOf(e.status).label, note: e.note, at: stamp(e.createdAt), bad: BAD.includes(e.status), done: true })),
    ...(pending
      ? [{ key: "next", label: status === "EXCEPTION" ? "Revisión de tu empresa" : "Desembolso", note: status === "EXCEPTION" ? "Talento Humano debe aprobar el monto." : "Enviando el dinero a tu cuenta.", at: "", bad: false, done: false }]
      : []),
  ];

  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <motion.li
          key={s.key}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex gap-3 pb-5 last:pb-0"
        >
          {i < steps.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[13px] w-0.5 rounded-full bg-green-200" />}
          <span
            className={cn(
              "relative grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-4",
              s.bad ? "bg-danger text-white" : s.done ? "bg-green-600 text-white" : "bg-surface text-ink-3 ring-2 ring-line ring-inset",
            )}
          >
            {s.bad ? <X weight="bold" /> : s.done ? <Check weight="bold" /> : <Clock weight="bold" />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <span className={cn("text-[15px] font-bold", s.done ? "text-ink" : "text-ink-3")}>{s.label}</span>
            {s.note && <span className="text-[13px] font-medium text-ink-2">{s.note}</span>}
            {s.at && <span className="text-xs font-semibold text-ink-3 tabular-nums">{s.at}</span>}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
