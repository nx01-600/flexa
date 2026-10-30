"use client";

import { useReducedMotion } from "motion/react";
import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/mock";

const axis = { fontSize: 12, fill: "#6b766f", fontFamily: "var(--font-manrope)", fontWeight: 600 };
const grid = { vertical: false, stroke: "#e5ece3", strokeDasharray: "4 4" };

// $1.200.000 -> "$1,2M", $800.000 -> "$800 mil"
export const short = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M` : n === 0 ? "$0" : `$${n / 1000} mil`;

// Short entry animation, none under reduced motion.
function useAnim() {
  const reduce = useReducedMotion();
  return { isAnimationActive: !reduce, animationDuration: 400 };
}

// Gradient ids must be unique per chart and valid in url(#...).
const useGradId = () => "g" + useId().replace(/[^a-zA-Z0-9]/g, "");

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm bg-surface px-3 py-2 shadow-lg ring-1 ring-line">
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      <p className="text-sm font-extrabold text-ink tabular-nums">{money(payload[0].value)}</p>
    </div>
  );
}

// Fixed-height wrapper so ResponsiveContainer measures on first paint.
function Frame({ height, children }: { height: number; children: React.ReactElement }) {
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data, x, height = 200, highlightLast }: { data: { value: number }[]; x: string; height?: number; highlightLast?: boolean }) {
  const g = useGradId();
  const anim = useAnim();
  return (
    <Frame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${g}a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fd08f" />
            <stop offset="100%" stopColor="#5dae64" />
          </linearGradient>
          <linearGradient id={`${g}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fa95c" />
            <stop offset="100%" stopColor="#2b7f40" />
          </linearGradient>
        </defs>
        <CartesianGrid {...grid} />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tick={axis} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={short} width={64} />
        <Tooltip content={<Tip />} cursor={{ fill: "#eef6ec", radius: 10 }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48} {...anim}>
          {data.map((_, i) => (
            <Cell key={i} fill={`url(#${g}${highlightLast && i === data.length - 1 ? "b" : "a"})`} />
          ))}
        </Bar>
      </BarChart>
    </Frame>
  );
}

export function TrendArea({ data, x, height = 200 }: { data: { value: number }[]; x: string; height?: number }) {
  const g = useGradId();
  const anim = useAnim();
  return (
    <Frame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5dae64" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#5dae64" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...grid} />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tick={axis} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={short} width={64} />
        <Tooltip content={<Tip />} cursor={{ stroke: "#a8d6a6", strokeDasharray: "4 4" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2b7f40"
          strokeWidth={3}
          fill={`url(#${g})`}
          dot={{ r: 4, fill: "#ffffff", stroke: "#2b7f40", strokeWidth: 2.5 }}
          activeDot={{ r: 6, fill: "#2b7f40", stroke: "#ffffff", strokeWidth: 2 }}
          {...anim}
        />
      </AreaChart>
    </Frame>
  );
}

export const donutColors = ["#2b7f40", "#4fa95c", "#7cc383", "#a8d6a6", "#cbe6c8"];

// Thick ring (thickness defaults to ~17% of the size). Two slices render as
// progress: gradient arc over a pale track. Children go in the center.
export function Donut({ data, size = 160, thickness, children }: { data: { name: string; value: number }[]; size?: number; thickness?: number; children?: React.ReactNode }) {
  const g = useGradId();
  const anim = useAnim();
  const t = thickness ?? Math.round(size * 0.17);
  const pair = data.length === 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4fa95c" />
            <stop offset="100%" stopColor="#1f6633" />
          </linearGradient>
        </defs>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={size / 2 - t}
          outerRadius={size / 2}
          startAngle={90}
          endAngle={-270}
          paddingAngle={2}
          cornerRadius={pair ? t / 2 : 4}
          stroke="none"
          {...anim}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={pair ? (i === 0 ? `url(#${g})` : "#ddefd8") : donutColors[i % donutColors.length]} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
