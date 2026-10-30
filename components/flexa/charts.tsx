"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/mock";

const axis = { fontSize: 12, fill: "#6b766f", fontFamily: "var(--font-manrope)" };

// $1.200.000 -> "$1,2M", $800.000 -> "$800 mil"
export const short = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M` : n === 0 ? "$0" : `$${n / 1000} mil`;

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-md">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-sm font-bold text-ink tabular-nums">{money(payload[0].value)}</p>
    </div>
  );
}

export function Bars({ data, x, height = 180, highlightLast }: { data: { value: number }[]; x: string; height?: number; highlightLast?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2eae0" />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tick={axis} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={short} width={72} />
        <Tooltip content={<Tip />} cursor={{ fill: "#e6f2e3", radius: 8 }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={600}>
          {data.map((_, i) => (
            <Cell key={i} fill={highlightLast && i === data.length - 1 ? "#2b7f40" : "#7cc383"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendArea({ data, x, height = 180 }: { data: { value: number }[]; x: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fa95c" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#4fa95c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e2eae0" />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tick={axis} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={short} width={72} />
        <Tooltip content={<Tip />} cursor={{ stroke: "#a8d6a6" }} />
        <Area type="monotone" dataKey="value" stroke="#2b7f40" strokeWidth={2.5} fill="url(#trend)" dot={{ r: 3.5, fill: "#2b7f40", strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const donutColors = ["#2b7f40", "#4fa95c", "#7cc383", "#a8d6a6", "#cbe6c8"];

export function Donut({ data, size = 140, thickness = 18, children }: { data: { name: string; value: number }[]; size?: number; thickness?: number; children?: React.ReactNode }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={size / 2 - thickness}
          outerRadius={size / 2}
          startAngle={90}
          endAngle={-270}
          paddingAngle={data.length > 2 ? 2 : 0}
          stroke="none"
          animationDuration={700}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={data.length === 2 ? (i === 0 ? "#2b7f40" : "#cbe6c8") : donutColors[i % donutColors.length]} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
