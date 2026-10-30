"use client";

import { useReducedMotion } from "motion/react";
import { BadgeCheck, Banknote, Clock, HandCoins, Info } from "@/components/flexa/icons";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { short } from "@/components/flexa/charts";
import { CardHead, Kebab, Kpi } from "@/components/flexa/empresas-ui";
import { Blob } from "@/components/flexa/shapes";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Card, IconBox } from "@/components/flexa/ui";
import { money } from "@/lib/mock";

// Simulated reconciliation: advances paid by Flexa vs. discounts applied in payroll.
const months = [
  { month: "May", given: 31_400_000, discounted: 31_400_000 },
  { month: "Jun", given: 34_900_000, discounted: 34_900_000 },
  { month: "Jul", given: 36_200_000, discounted: 36_050_000 },
  { month: "Ago", given: 41_800_000, discounted: 41_800_000 },
  { month: "Sep", given: 44_000_000, discounted: 44_000_000 },
  { month: "Oct", given: 48_200_000, discounted: 47_980_000 },
];

const axis = { fontSize: 12, fill: "#6b766f", fontFamily: "var(--font-manrope)", fontWeight: 600 };

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-sm bg-surface px-3 py-2 shadow-lg ring-1 ring-line">
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm font-bold text-ink tabular-nums">
          <i className="size-2.5 rounded-full" style={{ background: p.color }} />
          {p.name}: {money(p.value)}
        </p>
      ))}
    </div>
  );
}

export function ReturnsView() {
  const reduce = useReducedMotion();
  const given = months.at(-1)!.given;
  const disc = months.at(-1)!.discounted;
  const rate = ((months.reduce((a, m) => a + m.discounted, 0) / months.reduce((a, m) => a + m.given, 0)) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={HandCoins} value={money(given)} label="Anticipos entregados en octubre" />
        <Kpi icon={Banknote} value={money(disc)} label="Descontados en nómina" tone="teal" />
        <Kpi icon={Clock} value={money(given - disc)} label="Pendiente por conciliar" tone="amber" />
        <Kpi icon={BadgeCheck} value={`${rate}%`} label="Tasa de conciliación (6 meses)" tone="green" trend="Al día" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="flex flex-col gap-4 p-6">
          <CardHead
            title="Entregado frente a descontado"
            sub="Últimos 6 meses"
            action={
              <div className="flex items-center gap-4 text-[13px] font-semibold text-ink-2">
                <span className="flex items-center gap-2"><i className="size-3 rounded-full bg-green-400" />Entregado</span>
                <span className="flex items-center gap-2"><i className="size-3 rounded-full bg-green-700" />Descontado</span>
              </div>
            }
          />
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 280 }}>
              <BarChart data={months} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="#e5ece3" strokeDasharray="4 4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} dy={6} />
                <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={short} width={64} />
                <Tooltip content={<Tip />} cursor={{ fill: "#eef6ec", radius: 10 }} />
                <Bar name="Entregado" dataKey="given" fill="#7cc383" radius={[8, 8, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={400} />
                <Bar name="Descontado" dataKey="discounted" fill="#1f6633" radius={[8, 8, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={400} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card tone="mint" className="relative isolate flex flex-col gap-4 overflow-hidden p-6">
          <Blob shape={2} tone="deep" className="-right-20 -bottom-24 -z-10 size-[260px] opacity-60" />
          <CardHead title="Cómo funciona la conciliación" />
          <ol className="flex flex-col gap-4">
            {[
              ["Flexa entrega el anticipo", "El trabajador recibe el dinero en minutos en su cuenta."],
              ["Tu empresa descuenta en nómina", "El valor se aplica automáticamente en el siguiente pago."],
              ["Conciliamos cada periodo", "Comparamos lo entregado con lo descontado y te avisamos de cualquier diferencia."],
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
          <div className="mt-auto flex items-start gap-3 rounded-md bg-white/80 p-3.5 shadow-xs">
            <IconBox tone="amber" size="sm"><Info /></IconBox>
            <p className="text-[13px] font-medium text-ink-2">Octubre tiene {money(given - disc)} pendientes por una novedad de retiro de un trabajador.</p>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <CardHead title="Conciliación por periodo" sub="Detalle mensual de anticipos y descuentos" />
        <Table>
          <thead>
            <tr><Th>Periodo</Th><Th className="text-right">Entregado</Th><Th className="text-right">Descontado</Th><Th className="text-right">Diferencia</Th><Th>Estado</Th><Th className="w-14"><span className="sr-only">Acciones</span></Th></tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => {
              const diff = m.given - m.discounted;
              return (
                <tr key={m.month} className="transition-colors hover:bg-mint-1">
                  <Td className="font-bold">{m.month} 2026</Td>
                  <Td className="text-right tabular-nums">{money(m.given)}</Td>
                  <Td className="text-right tabular-nums">{money(m.discounted)}</Td>
                  <Td className={diff ? "text-right font-bold text-warning tabular-nums" : "text-right text-ink-2 tabular-nums"}>{money(diff)}</Td>
                  <Td>{diff ? <Badge tone="amber">En revisión</Badge> : <Badge>Conciliado</Badge>}</Td>
                  <Td className="text-right"><Kebab label={`Acciones para ${m.month} 2026`} /></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
