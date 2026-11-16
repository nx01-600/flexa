"use client";

import Link from "next/link";
import { PageHeader } from "@/components/flexa/company-shell";
import { EmptyState, ErrorState, LineBadge, Loading, PeriodBadge, SectionCard } from "@/components/flexa/empresas/kit";
import type { CompLine } from "@/components/flexa/empresas/types";
import { ReturnsView } from "@/components/flexa/empresas-returns";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { ButtonLink } from "@/components/flexa/ui";
import { money, useApi } from "@/lib/api";

type Pending = {
  byPeriod: { periodId: string; label: string; status: string; advances: number; toCompensate: number }[];
  openLines: CompLine[];
  totalPending: number;
};

export default function Reconciliation() {
  const { data, error, loading, reload } = useApi<Pending>("/compensation/pending");
  return (
    <>
      <PageHeader title="Compensación y conciliación" sub="Lo anticipado por Flexa, lo descontado en nómina y sus diferencias." />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <SectionCard>
          <CardHead title="Por compensar" sub="Periodos con anticipos que aún no se conciliaron" />
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading && !data ? (
            <Loading rows={3} />
          ) : !data?.byPeriod.length ? (
            <EmptyState title="Nada pendiente" text="Todos los periodos están conciliados." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.byPeriod.map((p) => (
                <li key={p.periodId} className="flex items-center gap-4 rounded-md bg-[#f6faf5] p-3.5">
                  <span className="flex flex-1 flex-col">
                    <span className="flex items-center gap-2 text-[15px] font-bold text-ink">{p.label} <PeriodBadge value={p.status} /></span>
                    <span className="text-[13px] font-medium text-ink-2 tabular-nums">{p.advances} anticipos · {money(p.toCompensate)}</span>
                  </span>
                  <ButtonLink href={`/empresas/conciliacion/${p.periodId}`} variant={p.status === "OPEN" ? "outline" : "primary"} size="sm">
                    {p.status === "OPEN" ? "Ver periodo" : "Conciliar"}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard>
          <CardHead title="Diferencias abiertas" sub={data ? `${money(data.totalPending)} sin compensar` : undefined} />
          {data && !data.openLines.length ? (
            <EmptyState title="Sin diferencias" text="Todo lo anticipado se descontó completo." />
          ) : data ? (
            <Table>
              <thead><tr><Th>Trabajador</Th><Th>Periodo</Th><Th className="text-right">A compensar</Th><Th className="text-right">Descontado</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {data.openLines.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-mint-1">
                    <Td className="font-bold">{l.worker.firstName} {l.worker.lastName}</Td>
                    <Td><Link href={`/empresas/conciliacion/${l.periodId}`} className="text-green-700 hover:underline">{l.period?.label}</Link></Td>
                    <Td className="text-right tabular-nums">{money(l.toCompensate)}</Td>
                    <Td className="text-right tabular-nums">{money(l.compensatedAmount)}</Td>
                    <Td><LineBadge value={l.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </SectionCard>
      </div>

      <ReturnsView />
    </>
  );
}
