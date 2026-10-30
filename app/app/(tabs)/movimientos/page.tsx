"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Receipt } from "@/components/flexa/icons";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { MovementRow } from "@/components/flexa/movement-row";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Backdrop } from "@/components/flexa/shapes";
import { Card, IconBox } from "@/components/flexa/ui";
import { money, movements, type Movement, type MovementKind } from "@/lib/mock";

const filters = [
  { value: "todos", label: "Todos" },
  { value: "retiro", label: "Retiros" },
  { value: "pago", label: "Pagos" },
  { value: "recarga", label: "Recargas" },
] as const;

const months: Record<string, string> = { ene: "Enero", feb: "Febrero", mar: "Marzo", abr: "Abril", may: "Mayo", jun: "Junio", jul: "Julio", ago: "Agosto", sep: "Septiembre", oct: "Octubre", nov: "Noviembre", dic: "Diciembre" };

// "12 abr 2025" -> "Abril 2025"
const monthOf = (date: string) => {
  const [, m, y] = date.split(" ");
  return `${months[m] ?? m} ${y}`;
};

function groupByMonth(list: Movement[]) {
  const groups = new Map<string, Movement[]>();
  for (const m of list) groups.set(monthOf(m.date), [...(groups.get(monthOf(m.date)) ?? []), m]);
  return [...groups];
}

export default function Movements() {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<"todos" | MovementKind>("todos");
  const list = filter === "todos" ? movements : movements.filter((m) => m.kind === filter);
  const withdrawn = movements.filter((m) => m.kind === "retiro").reduce((s, m) => s + m.amount, 0);
  const paid = movements.filter((m) => m.kind !== "retiro").reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Movimientos" />
      <main className="flex flex-col gap-4 px-5 pt-2">
        <PillTabs options={filters} value={filter} onChange={setFilter} full />

        <section aria-label="Resumen de los últimos 60 días" className="grid grid-cols-2 gap-3">
          <Card tone="red" className="flex items-center gap-3 p-4">
            <IconBox tone="red" size="sm">
              <ArrowUpRight className="stroke-[2.5]" />
            </IconBox>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-semibold text-ink-2">Retiros</span>
              <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink tabular-nums">{money(withdrawn)}</span>
            </span>
          </Card>
          <Card tone="green" className="flex items-center gap-3 p-4">
            <IconBox size="sm">
              <Receipt />
            </IconBox>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-semibold text-ink-2">Pagos y recargas</span>
              <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink tabular-nums">{money(paid)}</span>
            </span>
          </Card>
        </section>

        <AnimatePresence initial={false} mode="popLayout">
          {groupByMonth(list).map(([month, rows]) => (
            <motion.section
              key={month}
              layout={!reduce}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="flex flex-col gap-2"
            >
              <h2 className="px-1 text-sm font-bold text-ink-2">{month}</h2>
              <Card tone="soft" className="overflow-hidden">
                {rows.map((m, i) => (
                  <MovementRow key={m.id} m={m} divider={i > 0} />
                ))}
              </Card>
            </motion.section>
          ))}
        </AnimatePresence>
        <p className="pt-1 text-center text-[13px] font-medium text-ink-3">Mostrando los movimientos de los últimos 60 días</p>
      </main>
    </>
  );
}
