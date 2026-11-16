"use client";

import { ArrowUpRight, CalendarClock, CircleDollarSign, Clock, PiggyBank, Wallet } from "@/components/flexa/icons";
import { Donut } from "@/components/flexa/charts";
import { ScreenFrame } from "@/components/flexa/worker/screen-frame";
import { ErrorState, LoadingCards, Notice } from "@/components/flexa/worker/states";
import type { Earnings, Explanation } from "@/components/flexa/worker/types";
import { ButtonLink, Card, IconBox, StatTile } from "@/components/flexa/ui";
import { dateFmt, money, timeFmt, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// Módulo 2: earned salary, what's available and how it was calculated.
export default function Salary() {
  const earnings = useApi<Earnings>("/worker/earnings");
  const explanation = useApi<Explanation>("/worker/earnings/explanation");
  const e = earnings.data;

  if (!e)
    return (
      <ScreenFrame title="Mi salario">
        {earnings.loading ? <LoadingCards count={3} label="Calculando tu salario" /> : <ErrorState error={earnings.error} onRetry={earnings.reload} />}
      </ScreenFrame>
    );

  const earnedPct = e.periodSalary ? Math.round((e.grossEarned / e.periodSalary) * 100) : 0;
  const l = e.limits;

  return (
    <ScreenFrame title="Mi salario">
      <Card tone="mint" className="flex items-center gap-5 p-5">
        <Donut size={112} thickness={16} data={[{ name: "Devengado", value: e.grossEarned }, { name: "Por devengar", value: Math.max(e.periodSalary - e.grossEarned, 0) }]}>
          <span className="flex flex-col items-center">
            <span className="text-xl leading-none font-extrabold text-ink tabular-nums">{earnedPct}%</span>
            <span className="mt-1 text-[11px] font-semibold text-ink-3">devengado</span>
          </span>
        </Donut>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-green-900">Salario del periodo {e.period?.label}</span>
          <span className="text-money text-ink tabular-nums">{money(e.periodSalary)}</span>
          <span className="text-[13px] font-medium text-green-900">
            {e.workedDays} de {e.periodDays} días trabajados
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={CircleDollarSign} tone="white" label="Devengado bruto" value={money(e.grossEarned)} />
        <StatTile icon={Wallet} tone="green" label="Devengado neto" value={money(e.netEarned)} />
        <StatTile icon={ArrowUpRight} tone="teal" label="Disponible" value={<span className="text-green-600">{money(e.available)}</span>} />
        <StatTile icon={PiggyBank} tone="amber" label="Recomendado" value={money(e.recommended)} hint="Referencia, no límite" />
      </div>

      {e.blockers.length > 0 && (
        <Notice tone="warning" title="Retiros pausados">
          {e.blockers.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </Notice>
      )}

      <Card tone="soft" className="flex flex-col gap-4 p-5">
        <h2 className="text-h3 text-ink">¿Cómo calculamos tu disponible?</h2>
        {explanation.data ? (
          <>
            <ol className="flex flex-col">
              {explanation.data.steps.map((s, i) => {
                const total = /^(Devengado neto|Disponible)$/.test(s.label);
                return (
                  <li key={s.label} className={cn("flex items-start justify-between gap-4 py-3", i > 0 && "border-t border-line-soft", total && "rounded-sm")}>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={cn("text-sm text-ink", total ? "font-extrabold" : "font-bold")}>{s.label}</span>
                      <span className="text-[13px] font-medium text-ink-3">{s.detail}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm tabular-nums", total ? "font-extrabold text-green-700" : "font-bold", s.value < 0 ? "text-danger" : "text-ink")}>
                      {/días/i.test(s.label) ? s.value : s.value < 0 ? `−${money(-s.value)}` : money(s.value)}
                    </span>
                  </li>
                );
              })}
            </ol>
            <Notice tone="info">{explanation.data.note}</Notice>
          </>
        ) : explanation.loading ? (
          <LoadingCards count={1} />
        ) : (
          <ErrorState error={explanation.error} onRetry={explanation.reload} />
        )}
      </Card>

      <Card tone="soft" className="flex flex-col gap-1 p-5">
        <h2 className="mb-2 text-h3 text-ink">Reglas de tu empresa</h2>
        {[
          ["Tope del periodo", `${l.maxAdvancePct}% del neto · ${money(l.limitAmount)}`],
          ["Monto por retiro", `${money(l.minAmount)} a ${money(l.maxAmountPerRequest)}`],
          ["Retiros en el periodo", `${l.requestsUsed} de ${l.maxRequestsPerPeriod}`],
          ["Costo por retiro", l.feePerRequest ? money(l.feePerRequest) : "Sin costo"],
          ["Sin retiros", `${l.blackoutDaysBeforePay} días antes del pago`],
        ].map(([k, v], i) => (
          <div key={k} className={cn("flex items-center justify-between gap-4 py-2.5", i > 0 && "border-t border-line-soft")}>
            <span className="text-sm font-medium text-ink-2">{k}</span>
            <span className="text-right text-sm font-bold text-ink tabular-nums">{v}</span>
          </div>
        ))}
      </Card>

      <div className="flex flex-col gap-2 rounded-md px-1 text-[13px] font-medium text-ink-2">
        {e.period && (
          <span className="flex items-center gap-2">
            <IconBox size="sm" tone="gray">
              <CalendarClock />
            </IconBox>
            Pago de nómina: {dateFmt(e.period.payDate, { weekday: "long", day: "numeric", month: "long" })} · estimado {money(e.nextPayAfterUsage)}
          </span>
        )}
        <span className="flex items-center gap-2">
          <IconBox size="sm" tone="gray">
            <Clock />
          </IconBox>
          Datos actualizados el {dateFmt(e.dataUpdatedAt)} a las {timeFmt(e.dataUpdatedAt)}
        </span>
      </div>

      {e.canRequest && (
        <ButtonLink href="/app/retirar" className="mt-2">
          Retirar ahora
        </ButtonLink>
      )}
    </ScreenFrame>
  );
}
