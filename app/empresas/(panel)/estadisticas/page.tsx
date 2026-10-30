"use client";

import Link from "next/link";
import { ArrowUp, ChevronRight, CircleCheck } from "lucide-react";
import { useState } from "react";
import { Bars, Donut, donutColors, TrendArea } from "@/components/flexa/charts";
import { PageHeader } from "@/components/flexa/company-shell";
import { Pending } from "@/components/flexa/empty";
import { Period } from "@/components/flexa/period";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Card } from "@/components/flexa/ui";
import { categories, employees, money, monthlyWithdrawn, sites, weekdayWithdrawals } from "@/lib/mock";

const tabs = [
  { value: "retiros", label: "Retiros" },
  { value: "trabajadores", label: "Trabajadores" },
  { value: "zonas", label: "Zonas y sedes" },
  { value: "segmento", label: "Uso por segmento" },
] as const;

export default function Stats() {
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("retiros");
  return (
    <>
      <PageHeader
        title="Estadísticas"
        sub="Analiza el comportamiento de retiros y la salud financiera de tu empresa."
        action={<Period options={["Últimos 6 meses", "Últimos 3 meses", "Este año"]} />}
      />
      <PillTabs options={tabs} value={tab} onChange={setTab} className="self-start" />
      {tab === "retiros" && <Withdrawals />}
      {tab === "trabajadores" && <Ranking full />}
      {tab === "zonas" && <Sites big />}
      {tab === "segmento" && (
        <Pending title="Uso por segmento" text="Flexa está definiendo los segmentos (cargo, antigüedad, rango salarial). Esta vista se completa con el documento maestro." />
      )}
    </>
  );
}

function Withdrawals() {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Card className="flex flex-col gap-3 p-5">
          <span className="text-sm font-bold text-ink">Total retirado</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-extrabold tracking-[-0.02em] text-ink tabular-nums">{money(245_600_000)}</span>
            <span className="mb-1 inline-flex items-center gap-0.5 rounded-sm bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
              <ArrowUp className="size-3" /> 12 %
            </span>
          </div>
          <span className="-mt-2 text-xs text-ink-3">frente al periodo anterior</span>
          <TrendArea data={monthlyWithdrawn} x="month" height={190} />
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <span className="text-sm font-bold text-ink">Distribución de retiros</span>
          <div className="flex flex-1 items-center gap-5">
            <Donut data={categories} size={136} thickness={18}>
              <span className="flex flex-col">
                <span className="text-2xl leading-none font-extrabold text-ink">520</span>
                <span className="text-xs text-ink-2">retiros</span>
              </span>
            </Donut>
            <ul className="flex flex-col gap-2 text-xs">
              {categories.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: donutColors[i] }} />
                  <span className="w-9 shrink-0 font-bold whitespace-nowrap text-ink tabular-nums">{c.value} %</span>
                  <span className="text-ink-2">{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Ranking />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Card className="flex flex-col gap-3 p-5">
          <CardTitle title="Días de mayor retiro" />
          <Bars data={weekdayWithdrawals} x="day" height={200} />
        </Card>
        <Sites />
        <Card className="flex flex-col gap-4 border-green-200 bg-green-100/70 p-5">
          <span className="text-sm font-bold text-green-900">Lo más importante</span>
          <ul className="flex flex-col gap-3.5 text-sm text-ink">
            {[
              "Los retiros aumentaron 12 % frente al periodo anterior.",
              "El 66 % de los trabajadores se mantiene en los rangos recomendados.",
              "Los viernes son los días con mayor volumen de retiros.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-700" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function CardTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold text-ink">{title}</span>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-xs font-bold text-green-700 hover:underline">
          Ver más <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function Ranking({ full }: { full?: boolean }) {
  const sorted = [...employees].filter((e) => e.access).sort((a, b) => b.withdrawn - a.withdrawn);
  const groups = [
    { title: "Los que más retiran", list: sorted.slice(0, full ? 4 : 3) },
    { title: "Los que menos retiran", list: sorted.slice(full ? -4 : -3).reverse() },
  ];
  return (
    <Card className={full ? "grid gap-8 p-6 md:grid-cols-2" : "flex flex-col gap-4 p-5"}>
      {!full && <CardTitle title="Trabajadores" href="/empresas/trabajadores" />}
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-1">
          <span className="text-xs font-bold text-ink-2">{g.title}</span>
          <ol className="flex flex-col">
            {g.list.map((e, i) => (
              <li key={e.doc} className="flex h-9 items-center gap-3 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-green-100 text-xs font-bold text-green-900">{i + 1}</span>
                <span className="flex-1 text-ink">{e.name}</span>
                <span className="font-bold text-ink tabular-nums">{money(e.withdrawn)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </Card>
  );
}

function Sites({ big }: { big?: boolean }) {
  return (
    <Card className={big ? "flex flex-col gap-5 p-6" : "flex flex-col gap-4 p-5"}>
      <CardTitle title="Retiros por sede" />
      <ul className={big ? "flex flex-col gap-5" : "flex flex-col gap-3"}>
        {sites.map((s) => (
          <li key={s.name} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-xs">
            <span className="text-ink-2">{s.name}</span>
            <span className={big ? "h-4 rounded-sm bg-green-100" : "h-3 rounded-sm bg-green-100"}>
              <span className="block h-full rounded-sm bg-green-400" style={{ width: `${(s.value / sites[0].value) * 100}%` }} />
            </span>
            <span className="text-right font-bold text-ink tabular-nums">{s.value} %</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
