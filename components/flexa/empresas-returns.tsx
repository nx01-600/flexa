"use client";

import Link from "next/link";
import { BadgeCheck, Banknote, Clock, HandCoins, Info } from "@/components/flexa/icons";
import { GroupBars, Legend } from "@/components/flexa/empresas/charts";
import { EmptyState, ErrorState, Loading, ReconBadge } from "@/components/flexa/empresas/kit";
import type { Reconciliation } from "@/components/flexa/empresas/types";
import { CardHead, Kpi } from "@/components/flexa/empresas-ui";
import { Blob } from "@/components/flexa/shapes";
import { Table, Td, Th } from "@/components/flexa/table";
import { Card, IconBox } from "@/components/flexa/ui";
import { dateFmt, money, useApi } from "@/lib/api";

const series = [
  { key: "given", name: "Entregado", color: "#7cc383" },
  { key: "discounted", name: "Descontado", color: "#1f6633" },
];

// Reconciliation history: advances paid by Flexa vs. discounts applied in payroll.
export function ReturnsView() {
  const { data, error, loading, reload } = useApi<Reconciliation[]>("/compensation/reconciliations");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading rows={5} />;
  if (!data?.length)
    return (
      <Card className="p-6">
        <EmptyState icon={BadgeCheck} title="Aún no hay conciliaciones" text="Cuando cierres un periodo y reportes los descuentos, verás aquí el historial." />
      </Card>
    );

  const sorted = [...data].sort((a, b) => +new Date(a.period?.startDate ?? 0) - +new Date(b.period?.startDate ?? 0));
  const months = sorted.map((r) => ({ month: r.period?.label ?? "", given: r.disbursedTotal, discounted: r.compensatedTotal }));
  const last = sorted.at(-1)!;
  const givenAll = sorted.reduce((a, r) => a + r.disbursedTotal, 0);
  const discAll = sorted.reduce((a, r) => a + r.compensatedTotal, 0);
  const rate = givenAll ? ((discAll / givenAll) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) : "0";
  const pending = sorted.reduce((a, r) => a + (r.status === "RECONCILED" ? 0 : r.differenceTotal), 0);
  const open = sorted.filter((r) => r.status !== "RECONCILED");

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={HandCoins} value={money(last.disbursedTotal)} label={`Anticipos entregados en ${last.period?.label}`} />
        <Kpi icon={Banknote} value={money(last.compensatedTotal)} label="Descontados en nómina" tone="teal" />
        <Kpi icon={Clock} value={money(pending)} label="Pendiente por conciliar" tone="amber" />
        <Kpi icon={BadgeCheck} value={`${rate}%`} label={`Tasa de conciliación (${sorted.length} periodos)`} tone="green" trend={open.length ? `${open.length} abiertos` : "Al día"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="flex flex-col gap-4 p-6">
          <CardHead title="Entregado frente a descontado" sub="Por periodo de nómina" action={<Legend series={series} />} />
          <GroupBars data={months} x="month" series={series} />
        </Card>

        <Card tone="mint" className="relative isolate flex flex-col gap-4 overflow-hidden p-6">
          <Blob shape={2} tone="deep" className="-right-20 -bottom-24 -z-10 size-[260px] opacity-60" />
          <CardHead title="Cómo funciona la conciliación" />
          <ol className="flex flex-col gap-4">
            {[
              ["Flexa entrega el anticipo", "El trabajador recibe el dinero en minutos en su cuenta."],
              ["Tu empresa descuenta en nómina", "Al cerrar el periodo exportas el archivo y lo aplicas en el pago."],
              ["Conciliamos cada periodo", "Comparamos lo entregado con lo descontado y te mostramos cualquier diferencia."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-btn-primary text-sm font-extrabold text-white shadow-btn">{i + 1}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-green-900">{t}</span>
                  <span className="text-[13px] font-medium text-green-800">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          {open.length > 0 && (
            <div className="mt-auto flex items-start gap-3 rounded-md bg-white/80 p-3.5 shadow-xs">
              <IconBox tone="amber" size="sm"><Info /></IconBox>
              <p className="text-[13px] font-medium text-ink-2">
                {open.map((r) => r.period?.label).join(", ")} {open.length === 1 ? "tiene" : "tienen"} {money(pending)} por conciliar.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <CardHead title="Historial de conciliaciones" sub="Detalle por periodo de anticipos y descuentos" />
        <Table>
          <thead>
            <tr><Th>Periodo</Th><Th className="text-right">Entregado</Th><Th className="text-right">Descontado</Th><Th className="text-right">Diferencia</Th><Th>Cerrada</Th><Th>Estado</Th></tr>
          </thead>
          <tbody>
            {[...sorted].reverse().map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-mint-1">
                <Td><Link href={`/empresas/conciliacion/${r.periodId}`} className="font-bold text-green-700 hover:underline">{r.period?.label}</Link></Td>
                <Td className="text-right tabular-nums">{money(r.disbursedTotal)}</Td>
                <Td className="text-right tabular-nums">{money(r.compensatedTotal)}</Td>
                <Td className={r.differenceTotal ? "text-right font-bold text-warning tabular-nums" : "text-right text-ink-2 tabular-nums"}>{money(r.differenceTotal)}</Td>
                <Td className="text-ink-2">{dateFmt(r.closedAt)}</Td>
                <Td><ReconBadge value={r.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
