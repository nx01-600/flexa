"use client";

import Link from "next/link";
import { ArrowUp, CalendarDays, ChevronRight, MapPin, ShieldCheck, TrendingUp, Trophy } from "@/components/flexa/icons";
import { useState } from "react";
import { Bars, Donut, donutColors, TrendArea } from "@/components/flexa/charts";
import { PageHeader } from "@/components/flexa/company-shell";
import { Pending } from "@/components/flexa/empty";
import { Avatar, CardHead, Kpi } from "@/components/flexa/empresas-ui";
import { ReturnsView } from "@/components/flexa/empresas-returns";
import { Period } from "@/components/flexa/period";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Blob } from "@/components/flexa/shapes";
import { Card, IconBox } from "@/components/flexa/ui";
import { categories, employees, money, monthlyWithdrawn, sites, weekdayWithdrawals } from "@/lib/mock";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "retiros", label: "Retiros" },
  { value: "trabajadores", label: "Trabajadores" },
  { value: "zonas", label: "Zonas y sedes" },
  { value: "segmento", label: "Uso por segmento" },
  { value: "rendimientos", label: "Rendimientos" },
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
      <PillTabs variant="segmented" options={tabs} value={tab} onChange={setTab} />
      {tab === "retiros" && <Withdrawals />}
      {tab === "trabajadores" && <WorkersTab />}
      {tab === "zonas" && <SitesTab />}
      {tab === "segmento" && (
        <Pending title="Uso por segmento" text="Pronto podrás comparar el uso de Flexa por cargo, antigüedad y rango salarial. Estamos definiendo los segmentos con tu equipo." />
      )}
      {tab === "rendimientos" && <ReturnsView />}
    </>
  );
}

function Withdrawals() {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr_1fr]">
        <Card className="flex flex-col gap-2 p-6">
          <span className="text-[15px] font-bold text-ink-2">Total retirado</span>
          <div className="flex items-center gap-3">
            <span className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-ink tabular-nums">{money(245_600_000)}</span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-green-100 px-2.5 text-xs font-bold text-green-700">
              <ArrowUp className="size-3.5 stroke-[2.5]" />12%
            </span>
          </div>
          <span className="text-[13px] font-medium text-ink-2">frente al periodo anterior</span>
          <div className="mt-2 flex-1">
            <TrendArea data={monthlyWithdrawn} x="month" height={240} />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <CardHead title="Distribución de retiros" />
          <div className="flex justify-center">
            <Donut data={categories} size={180}>
              <span className="flex flex-col">
                <span className="text-[32px] leading-none font-extrabold tracking-[-0.03em] text-ink">520</span>
                <span className="text-[13px] font-semibold text-ink-2">retiros</span>
              </span>
            </Donut>
          </div>
          <Legend />
        </Card>

        <Ranking />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr_1fr]">
        <Card className="flex flex-col gap-3 p-6">
          <CardHead title="Días de mayor retiro" href="/empresas/estadisticas" />
          <Bars data={weekdayWithdrawals} x="day" height={220} />
        </Card>
        <Card className="flex flex-col gap-5 p-6">
          <CardHead title="Retiros por zona / sede" />
          <SiteBars />
        </Card>
        <Insights />
      </div>
    </>
  );
}

function Legend() {
  return (
    <ul className="flex flex-col gap-2">
      {categories.map((c, i) => (
        <li key={c.name} className="flex items-center gap-2.5 text-[13px]">
          <i className="size-3 shrink-0 rounded-full" style={{ background: donutColors[i] }} />
          <span className="flex-1 truncate font-semibold text-ink-2">{c.name}</span>
          <span className="font-extrabold text-ink tabular-nums">{c.value}%</span>
        </li>
      ))}
    </ul>
  );
}

function Insights() {
  const items = [
    { icon: TrendingUp, text: "Los retiros aumentaron 12% en comparación con el periodo anterior." },
    { icon: ShieldCheck, text: "El 66% de los trabajadores se mantiene en los rangos recomendados." },
    { icon: CalendarDays, text: "Los viernes son los días con mayor volumen de retiros." },
  ];
  return (
    <Card className="relative isolate flex flex-col gap-4 overflow-hidden bg-[linear-gradient(160deg,#e3f1df_0%,#f4faf3_100%)] p-6">
      <Blob shape={0} tone="deep" className="-right-16 -bottom-16 -z-10 size-52 opacity-50" />
      <CardHead title="Insights clave" />
      <ul className="flex flex-col gap-3.5">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <IconBox tone="white" size="sm"><Icon /></IconBox>
            <span className="pt-1 text-sm font-semibold text-green-900">{text}</span>
          </li>
        ))}
      </ul>
      <Link href="/empresas/rendimientos" className="mt-auto inline-flex items-center gap-1 self-end text-sm font-bold text-green-700 underline-offset-4 hover:underline [&_svg]:size-4">
        Ver análisis completo <ChevronRight />
      </Link>
    </Card>
  );
}

const sortedWorkers = [...employees].filter((e) => e.access).sort((a, b) => b.withdrawn - a.withdrawn);

function RankList({ list, top }: { list: typeof employees; top: boolean }) {
  return (
    <ol className="flex flex-col">
      {list.map((e, i) => (
        <li key={e.doc} className="flex h-10 items-center gap-3 text-sm">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold",
              top ? (i === 0 ? "bg-green-600 text-white shadow-btn" : "bg-green-200 text-green-900") : "bg-[#eef2ec] text-ink-2",
            )}
          >
            {i + 1}
          </span>
          <span className="flex-1 truncate font-semibold text-ink">{e.name}</span>
          <span className="font-bold text-ink tabular-nums">{money(e.withdrawn)}</span>
        </li>
      ))}
    </ol>
  );
}

function Ranking() {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <CardHead title="Trabajadores" href="/empresas/trabajadores" />
      <span className="text-[13px] font-bold text-ink-2">Los que más retiran</span>
      <RankList list={sortedWorkers.slice(0, 3)} top />
      <span className="mt-1 text-[13px] font-bold text-ink-2">Los que menos retiran</span>
      <RankList list={sortedWorkers.slice(-3).reverse()} top={false} />
    </Card>
  );
}

function WorkersTab() {
  const max = sortedWorkers[0].withdrawn;
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Kpi icon={Trophy} value={sortedWorkers[0].name} label={`Mayor uso: ${money(max)}`} />
        <Kpi icon={ShieldCheck} value="66%" label="En rangos recomendados" tone="teal" />
        <Kpi icon={CalendarDays} value="2,1" label="Retiros promedio por persona" tone="amber" />
      </div>
      <Card className="flex flex-col gap-4 p-6">
        <CardHead title="Ranking de uso" sub="Monto retirado en el periodo por trabajador habilitado" href="/empresas/trabajadores" />
        <ul className="flex flex-col">
          {sortedWorkers.map((e, i) => (
            <li key={e.doc} className="grid h-16 grid-cols-[28px_40px_200px_1fr_120px] items-center gap-3 border-b border-line-soft last:border-0">
              <span className="text-sm font-extrabold text-ink-3 tabular-nums">{i + 1}</span>
              <Avatar name={e.name} className="size-10" />
              <span className="flex flex-col">
                <span className="text-[15px] font-bold text-ink">{e.name}</span>
                <span className="text-[13px] font-medium text-ink-2">Sede {e.site}</span>
              </span>
              <span className="h-3 rounded-full bg-green-100">
                <span className="block h-full rounded-full bg-linear-to-r from-green-300 to-green-500" style={{ width: `${Math.max((e.withdrawn / max) * 100, 3)}%` }} />
              </span>
              <span className="text-right text-[15px] font-bold text-ink tabular-nums">{money(e.withdrawn)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function SiteBars({ big }: { big?: boolean }) {
  return (
    <ul className={cn("flex flex-col", big ? "gap-5" : "flex-1 justify-between pb-2")}>
      {sites.map((s) => (
        <li key={s.name} className={cn("grid items-center gap-3", big ? "grid-cols-[150px_1fr_48px] text-sm" : "grid-cols-[124px_1fr_40px] text-[13px]")}>
          <span className="truncate font-semibold text-ink-2">{s.name}</span>
          <span className={cn("rounded-full bg-green-100", big ? "h-4" : "h-3.5")}>
            <span className="block h-full rounded-full bg-linear-to-r from-green-300 to-green-500" style={{ width: `${(s.value / sites[0].value) * 100}%` }} />
          </span>
          <span className="text-right font-extrabold text-ink tabular-nums">{s.value}%</span>
        </li>
      ))}
    </ul>
  );
}

function SitesTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card className="flex flex-col gap-6 p-6">
        <CardHead title="Retiros por sede" sub="Participación de cada sede en el total retirado" />
        <SiteBars big />
      </Card>
      <div className="flex flex-col gap-4">
        {sites.slice(0, 3).map((s, i) => (
          <Card key={s.name} tone={i === 0 ? "green" : "soft"} className="flex items-center gap-4 p-5">
            <IconBox size="lg" tone={i === 0 ? "solid" : "green"}><MapPin /></IconBox>
            <div className="flex flex-1 flex-col">
              <span className="text-[15px] font-bold text-ink">{s.name}</span>
              <span className="text-[13px] font-medium text-ink-2">{money((245_600_000 * s.value) / 100)} retirados</span>
            </div>
            <span className="text-[26px] font-extrabold tracking-[-0.03em] text-ink tabular-nums">{s.value}%</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
