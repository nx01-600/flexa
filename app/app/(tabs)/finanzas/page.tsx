"use client";

import { CalendarDays, CircleDollarSign, CircleMinus, HeartPulse, PiggyBank, Repeat, TriangleAlert } from "@/components/flexa/icons";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Bars, Donut } from "@/components/flexa/charts";
import { Choice } from "@/components/flexa/choice";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { Badge, Card, IconBox, StatTile } from "@/components/flexa/ui";
import { money, weeklyEarned, worker } from "@/lib/mock";

const sections = [
  { value: "resumen", label: "Resumen" },
  { value: "analisis", label: "Análisis" },
  { value: "recomendaciones", label: "Recomendaciones" },
] as const;

type Section = (typeof sections)[number]["value"];

export default function Finances() {
  const [tab, setTab] = useState<Section>("resumen");
  const [period, setPeriod] = useState("Este mes");

  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Mis finanzas" />
      <main className="flex flex-col gap-4 px-5 pt-2">
        <PillTabs options={sections} value={tab} onChange={setTab} full />
        {tab === "resumen" && <Summary period={period} setPeriod={setPeriod} />}
        {tab === "analisis" && <Analysis />}
        {tab === "recomendaciones" && <Recommendations />}
      </main>
    </>
  );
}

function Summary({ period, setPeriod }: { period: string; setPeriod: (v: string) => void }) {
  return (
    <>
      <Choice
        options={["Este mes", "Mes anterior", "Últimos 3 meses"]}
        value={period}
        onChange={setPeriod}
        icon={CalendarDays}
        className="h-12 border-0 text-[15px] data-[size=default]:h-12 font-semibold shadow-sm ring-1 ring-line"
      />
      <Card tone="soft" className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink-2">Total devengado</span>
            <span className="text-display text-ink tabular-nums">{money(worker.earned)}</span>
          </div>
          <Badge>Semana 4</Badge>
        </div>
        <Bars data={weeklyEarned} x="week" height={190} highlightLast />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={CircleMinus} tone="red" label="Total retirado" value={money(worker.withdrawn)} />
        <StatTile icon={CircleDollarSign} tone="green" label="Disponible" value={<span className="text-green-600">{money(worker.available)}</span>} />
      </div>
    </>
  );
}

function Analysis() {
  const pct = Math.round((worker.withdrawn / worker.earned) * 100);
  return (
    <>
      <Card tone="soft" className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3 text-ink">Tu comportamiento financiero</h2>
          <p className="text-sm font-medium text-ink-2">
            Este mes has retirado el {pct}% de tu salario devengado. Aún tienes un buen control, ¡sigue así!
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Donut size={150} thickness={26} data={[{ name: "Retirado", value: worker.withdrawn }, { name: "Disponible", value: worker.available }]}>
            <span className="flex flex-col items-center">
              <span className="text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">{pct}%</span>
              <span className="mt-1 text-xs font-semibold text-ink-3">retirado</span>
            </span>
          </Donut>
          <dl className="flex flex-col gap-4">
            <div className="flex gap-2.5">
              <i className="mt-1 size-3 shrink-0 rounded-full bg-linear-to-br from-green-500 to-green-700" />
              <div>
                <dt className="text-[13px] font-semibold text-ink-2">Total retirado</dt>
                <dd className="text-[17px] font-extrabold text-ink tabular-nums">{money(worker.withdrawn)}</dd>
              </div>
            </div>
            <div className="flex gap-2.5">
              <i className="mt-1 size-3 shrink-0 rounded-full bg-[#ddefd8] ring-1 ring-green-200" />
              <div>
                <dt className="text-[13px] font-semibold text-ink-2">Disponible</dt>
                <dd className="text-[17px] font-extrabold text-ink tabular-nums">{money(worker.available)}</dd>
              </div>
            </div>
          </dl>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-[#fff8e6] p-3 ring-1 ring-[#f5e2ad] ring-inset">
          <IconBox tone="amber" size="sm" className="bg-[#ffe9a8]">
            <TriangleAlert />
          </IconBox>
          <p className="text-sm font-medium text-ink">Si mantienes este ritmo de retiro, tu liquidez futura podría verse afectada en los próximos días.</p>
        </div>
      </Card>
      <Card tone="soft" className="flex flex-col gap-4 p-5">
        <h2 className="text-h3 text-ink">Días en los que más necesitas dinero</h2>
        <div className="grid grid-cols-3 gap-3">
          {[5, 15, 25].map((d) => (
            <span key={d} className="flex flex-col items-center gap-0.5 rounded-md bg-surface py-3 shadow-sm ring-1 ring-black/[0.03]">
              <span className="text-[22px] leading-none font-extrabold text-green-600 tabular-nums">{d}</span>
              <span className="text-xs font-semibold text-ink-2">de cada mes</span>
            </span>
          ))}
        </div>
        <p className="text-sm font-medium text-ink-2">Según tus movimientos, en estos días realizas la mayoría de tus retiros.</p>
      </Card>
    </>
  );
}

const recs = [
  { icon: PiggyBank, tone: "green", tag: "Ahorro", title: "Separa un colchón pequeño", text: "Deja al menos $50.000 sin retirar para imprevistos de fin de mes." },
  { icon: CalendarDays, tone: "teal", tag: "Planeación", title: "Planea alrededor del día 15", text: "Ahí se concentran tus retiros. Agenda tus pagos fijos para después de la quincena." },
  { icon: Repeat, tone: "amber", tag: "Hábito", title: "Un retiro grande en vez de varios", text: "Juntar retiros pequeños te ayuda a tener claro cuánto vas sacando." },
] as const;

function Recommendations() {
  const score = 72;
  return (
    <>
      <Card tone="mint" className="relative isolate flex items-center gap-4 overflow-hidden p-5">
        <Blob shape={1} tone="deep" className="-top-10 -right-12 -z-10 size-40 opacity-70" />
        <Donut size={92} thickness={14} data={[{ name: "Puntaje", value: score }, { name: "Resto", value: 100 - score }]}>
          <span className="text-xl font-extrabold text-ink tabular-nums">{score}</span>
        </Donut>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
            <HeartPulse className="size-4 stroke-[2.5]" />
            Tu salud financiera
          </span>
          <span className="text-h2 text-ink">Buena</span>
          <span className="text-[13px] font-medium text-green-900">Sigue estas ideas para subir tu puntaje.</span>
        </div>
      </Card>
      {recs.map(({ icon: Icon, tone, tag, title, text }) => (
        <Card key={title} tone="soft" className="flex gap-4 p-5">
          <IconBox tone={tone}>
            <Icon />
          </IconBox>
          <div className="flex flex-col gap-1.5">
            <Badge tone={tone} className="h-6 self-start px-2.5">{tag}</Badge>
            <h3 className="text-base font-bold text-ink">{title}</h3>
            <p className="text-sm font-medium text-ink-2">{text}</p>
          </div>
        </Card>
      ))}
    </>
  );
}
