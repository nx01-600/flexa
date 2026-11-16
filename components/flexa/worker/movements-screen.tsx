"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowUpRight, ChevronRight, Download, Receipt } from "@/components/flexa/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { MovementRow } from "@/components/flexa/movement-row";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Backdrop } from "@/components/flexa/shapes";
import { EmptyState, ErrorState, LoadingRows, Notice } from "@/components/flexa/worker/states";
import { statusOf, type Advance, type Movement, type MovementKind } from "@/components/flexa/worker/types";
import { Badge, ButtonLink, Card, IconBox } from "@/components/flexa/ui";
import { dateFmt, download, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const views = [
  { value: "movimientos", label: "Movimientos" },
  { value: "solicitudes", label: "Solicitudes" },
] as const;

const filters = [
  { value: "todos", label: "Todos" },
  { value: "retiro", label: "Retiros" },
  { value: "pago", label: "Pagos" },
  { value: "recarga", label: "Recargas" },
] as const;

type View = (typeof views)[number]["value"];

// "Noviembre 2026"
const monthOf = (d: string) => {
  const s = new Date(d).toLocaleDateString("es-CO", { month: "long", year: "numeric" }).replace(" de ", " ");
  return s[0].toUpperCase() + s.slice(1);
};

function groupByMonth<T extends { date: string }>(list: T[]) {
  const groups = new Map<string, T[]>();
  for (const m of list) groups.set(monthOf(m.date), [...(groups.get(monthOf(m.date)) ?? []), m]);
  return [...groups];
}

export function MovementsScreen() {
  const router = useRouter();
  const path = usePathname();
  const view: View = useSearchParams().get("vista") === "solicitudes" ? "solicitudes" : "movimientos";
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await download("/worker/history/export", `historial-flexa-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      setExportError("No pudimos descargar tu historial. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar
        title="Movimientos"
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            aria-label="Descargar historial (CSV)"
            className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-black/[0.03] transition-transform duration-150 active:scale-95 disabled:opacity-50 [&_svg]:size-5"
          >
            <Download weight="bold" className={cn(exporting && "animate-pulse")} />
          </button>
        }
      />
      <main className="flex flex-col gap-4 px-5 pt-2">
        <PillTabs variant="segmented" options={views} value={view} onChange={(v) => router.replace(v === "movimientos" ? path : `${path}?vista=${v}`, { scroll: false })} />
        {exportError && <Notice tone="error">{exportError}</Notice>}
        {view === "movimientos" ? <MovementList /> : <AdvanceList />}
      </main>
    </>
  );
}

function MovementList() {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<"todos" | MovementKind>("todos");
  const { data, error, loading, reload } = useApi<Movement[]>(filter === "todos" ? "/worker/movements" : `/worker/movements?kind=${filter}`);
  const all = useApi<Movement[]>("/worker/movements");
  const ok = (m: Movement) => !["CANCELLED", "REJECTED", "FAILED"].includes(m.status);
  const withdrawn = (all.data ?? []).filter((m) => m.kind === "retiro" && ok(m)).reduce((s, m) => s + m.amount, 0);
  const paid = (all.data ?? []).filter((m) => m.kind !== "retiro" && ok(m)).reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <PillTabs options={filters} value={filter} onChange={setFilter} full />

      {all.data && (
        <section aria-label="Resumen del historial" className="grid grid-cols-2 gap-3">
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
      )}

      {loading && !data ? (
        <LoadingRows count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          icon={Receipt}
          title={filter === "todos" ? "Aún no tienes movimientos" : "Nada por aquí"}
          text={filter === "todos" ? "Tus retiros, pagos y recargas aparecerán aquí." : "No tienes movimientos de este tipo."}
        />
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
          <AnimatePresence initial={false} mode="popLayout">
            {groupByMonth(data).map(([month, rows]) => (
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
        </div>
      )}
    </>
  );
}

function AdvanceList() {
  const { data, error, loading, reload } = useApi<Advance[]>("/worker/advances");
  if (loading && !data) return <LoadingRows count={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.length)
    return (
      <EmptyState
        icon={ArrowUpRight}
        title="Sin solicitudes todavía"
        text="Cada retiro que pidas queda aquí con su estado."
        action={
          <ButtonLink href="/app/retirar" size="sm">
            Retirar
          </ButtonLink>
        }
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {groupByMonth(data.map((a) => ({ ...a, date: a.createdAt }))).map(([month, rows]) => (
        <section key={month} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold text-ink-2">{month}</h2>
          <Card tone="soft" className="overflow-hidden">
            {rows.map((a, i) => {
              const st = statusOf(a.status);
              return (
                <Link key={a.id} href={`/app/solicitudes/${a.id}`} className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70">
                  <IconBox tone={st.tone === "red" ? "red" : st.tone === "amber" ? "amber" : st.tone === "gray" ? "gray" : "green"}>
                    <ArrowUpRight />
                  </IconBox>
                  <span className={cn("flex min-h-[68px] min-w-0 flex-1 items-center gap-2 pr-3", i > 0 && "border-t border-line-soft")}>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-bold text-ink tabular-nums">{money(a.amount)}</span>
                      <span className="truncate text-[13px] font-medium text-ink-3">
                        {a.code} · {dateFmt(a.createdAt, { day: "numeric", month: "short" })}
                      </span>
                    </span>
                    <Badge tone={st.tone} className="h-6 px-2.5">
                      {st.label}
                    </Badge>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
