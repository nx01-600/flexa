"use client";

import { CalendarDays, CircleMinus, PiggyBank, Repeat, TriangleAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Bars, Donut } from "@/components/flexa/charts";
import { Choice } from "@/components/flexa/choice";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Card, IconBox } from "@/components/flexa/ui";
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
      <TopBar title="Mis finanzas" />
      <main className="flex flex-col gap-4 px-5 pt-1">
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
      <Choice options={["Este mes", "Mes anterior", "Últimos 3 meses"]} value={period} onChange={setPeriod} className="h-11 text-[15px]" />
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink-2">Total devengado</span>
          <span className="text-display font-extrabold text-ink tabular-nums">{money(worker.earned)}</span>
        </div>
        <Bars data={weeklyEarned} x="week" highlightLast />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-3 p-4">
          <IconBox tone="red"><CircleMinus /></IconBox>
          <span className="flex flex-col">
            <span className="text-sm text-ink-2">Total retirado</span>
            <span className="text-xl font-extrabold text-ink tabular-nums">{money(worker.withdrawn)}</span>
          </span>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <IconBox><Wallet /></IconBox>
          <span className="flex flex-col">
            <span className="text-sm text-ink-2">Disponible</span>
            <span className="text-xl font-extrabold text-green-600 tabular-nums">{money(worker.available)}</span>
          </span>
        </Card>
      </div>
    </>
  );
}

function Analysis() {
  const pct = Math.round((worker.withdrawn / worker.earned) * 100);
  return (
    <>
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-ink">Tu comportamiento financiero</h2>
          <p className="text-sm text-ink-2">
            Este mes has retirado el {pct} % de tu salario devengado. Aún tienes un buen control, ¡sigue así!
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Donut data={[{ name: "Retirado", value: worker.withdrawn }, { name: "Disponible", value: worker.available }]}>
            <span className="text-2xl font-extrabold text-ink tabular-nums">{pct} %</span>
          </Donut>
          <dl className="flex flex-col gap-3">
            <div className="flex gap-2">
              <i className="mt-1.5 size-2.5 rounded-full bg-green-600" />
              <div><dt className="text-xs text-ink-3">Total retirado</dt><dd className="font-bold text-ink tabular-nums">{money(worker.withdrawn)}</dd></div>
            </div>
            <div className="flex gap-2">
              <i className="mt-1.5 size-2.5 rounded-full bg-green-200" />
              <div><dt className="text-xs text-ink-3">Disponible</dt><dd className="font-bold text-ink tabular-nums">{money(worker.available)}</dd></div>
            </div>
          </dl>
        </div>
        <div className="flex gap-3 rounded-md bg-warning-soft p-3">
          <TriangleAlert className="size-5 shrink-0 text-warning-icon" />
          <p className="text-sm text-ink">Si mantienes este ritmo de retiro, tu liquidez futura podría verse afectada en los próximos días.</p>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-ink">Días en los que más necesitas dinero</h2>
        <div className="flex gap-2">
          {[5, 15, 25].map((d) => (
            <span key={d} className="grid h-14 flex-1 place-items-center rounded-md bg-green-100 text-center">
              <span className="text-lg leading-none font-extrabold text-green-900">{d}</span>
              <span className="text-[11px] font-semibold text-green-900/70">de cada mes</span>
            </span>
          ))}
        </div>
        <p className="text-sm text-ink-2">Según tus movimientos, en estos días realizas la mayoría de tus retiros.</p>
      </Card>
    </>
  );
}

const recs = [
  { icon: PiggyBank, title: "Separa un colchón pequeño", text: "Deja al menos $50.000 sin retirar para imprevistos de fin de mes." },
  { icon: CalendarDays, title: "Planea alrededor del día 15", text: "Ahí se concentran tus retiros. Agenda tus pagos fijos para después de la quincena." },
  { icon: Repeat, title: "Un retiro grande en vez de varios", text: "Juntar retiros pequeños te ayuda a tener claro cuánto vas sacando." },
];

function Recommendations() {
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {recs.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-3 p-4">
          <IconBox><Icon /></IconBox>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[15px] font-bold text-ink">{title}</h3>
            <p className="text-sm text-ink-2">{text}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
