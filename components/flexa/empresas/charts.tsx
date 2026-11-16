"use client";

import { useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { short } from "@/components/flexa/charts";
import { money } from "@/lib/api";
import { cn } from "@/lib/utils";

const axis = { fontSize: 12, fill: "#6b766f", fontFamily: "var(--font-manrope)", fontWeight: 600 };

type Series = { key: string; name: string; color: string; line?: boolean };

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-sm bg-surface px-3 py-2 shadow-lg ring-1 ring-line">
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm font-bold text-ink tabular-nums">
          <i className="size-2.5 rounded-full" style={{ background: p.color }} />
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold text-ink-2">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-2">
          <i className={cn("rounded-full", s.line ? "h-1 w-4" : "size-3")} style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

// Grouped bars with optional line series (e.g. budget). Money by default.
export function GroupBars({ data, x, series, height = 280, fmt = money, tick = short }: { data: object[]; x: string; series: Series[]; height?: number; fmt?: (n: number) => string; tick?: (n: number) => string }) {
  const reduce = useReducedMotion();
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ComposedChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="#e5ece3" strokeDasharray="4 4" />
          <XAxis dataKey={x} tickLine={false} axisLine={false} tick={axis} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={tick} width={64} />
          <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: "#eef6ec", radius: 10 }} />
          {series.map((s) =>
            s.line ? (
              <Line key={s.key} name={s.name} dataKey={s.key} stroke={s.color} strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={!reduce} animationDuration={400} />
            ) : (
              <Bar key={s.key} name={s.name} dataKey={s.key} fill={s.color} radius={[8, 8, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={400} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Horizontal single-series bars (for counts or money by category).
export function HBars({ data, height = 260, fmt = money }: { data: { name: string; value: number }[]; height?: number; fmt?: (n: number) => string }) {
  const reduce = useReducedMotion();
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#e5ece3" strokeDasharray="4 4" />
          <XAxis type="number" tickLine={false} axisLine={false} tick={axis} tickFormatter={short} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={axis} width={130} />
          <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: "#eef6ec" }} />
          <Bar name="Valor" dataKey="value" fill="#4fa95c" radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={400} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Ranked list with share bars; reads better than a pie for 4-8 categories.
export function ShareList({ items }: { items: { name: string; value: number; pct: number }[] }) {
  const max = Math.max(...items.map((i) => i.pct), 1);
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((i) => (
        <li key={i.name} className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-bold text-ink">{i.name}</span>
            <span className="font-semibold text-ink-2 tabular-nums">
              {money(i.value)} <span className="text-ink-3">· {i.pct.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%</span>
            </span>
          </span>
          <span className="h-2 rounded-full bg-green-100">
            <span className="block h-full rounded-full bg-linear-to-r from-green-300 to-green-600" style={{ width: `${(i.pct / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
