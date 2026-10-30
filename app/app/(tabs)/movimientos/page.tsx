"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { MovementRow } from "@/components/flexa/movement-row";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { movements, type MovementKind } from "@/lib/mock";

const filters = [
  { value: "todos", label: "Todos" },
  { value: "retiro", label: "Retiros" },
  { value: "pago", label: "Pagos" },
  { value: "recarga", label: "Recargas" },
] as const;

export default function Movements() {
  const [filter, setFilter] = useState<"todos" | MovementKind>("todos");
  const list = filter === "todos" ? movements : movements.filter((m) => m.kind === filter);

  return (
    <>
      <TopBar title="Movimientos" />
      <main className="flex flex-col gap-4 px-5 pt-1">
        <PillTabs options={filters} value={filter} onChange={setFilter} full />
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-b border-line last:border-b-0"
              >
                <MovementRow m={m} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <p className="pb-2 text-center text-xs text-ink-3">Mostrando los movimientos de los últimos 60 días</p>
      </main>
    </>
  );
}
