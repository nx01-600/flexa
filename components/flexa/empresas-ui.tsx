import Link from "next/link";
import { Check, ChevronRight, EllipsisVertical, type IconType } from "@/components/flexa/icons";
import type { ReactNode } from "react";
import { Blob } from "@/components/flexa/shapes";
import { Card, IconBox } from "@/components/flexa/ui";
import { cn } from "@/lib/utils";

// Desktop-only building blocks for Flexa Empresas.

type Tone = "green" | "teal" | "amber" | "red";

// KPI tile: tinted gradient, icon circle top-left, optional trend chip, heavy number.
// Stacked so long money values ($48.200.000) never clip in a 4-column row.
export function Kpi({ icon: Icon, value, label, tone = "green", trend, className }: { icon: IconType; value: ReactNode; label: string; tone?: Tone; trend?: ReactNode; className?: string }) {
  return (
    <Card tone={tone} className={cn("relative isolate flex flex-col gap-4 overflow-hidden p-5", className)}>
      <Blob shape={1} tone={tone === "red" ? "pink" : "green"} className="-top-12 -right-12 -z-10 size-32 opacity-45" />
      <div className="flex items-start justify-between gap-2">
        <IconBox tone={tone}>
          <Icon />
        </IconBox>
        {trend && <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/85 px-2.5 text-xs font-bold text-green-700 shadow-xs">{trend}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[26px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">{value}</span>
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      </div>
    </Card>
  );
}

// Card heading with an optional "Ver más" link or custom action.
export function CardHead({ title, sub, href, action, className }: { title: string; sub?: string; href?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[17px] leading-snug font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
        {sub && <p className="text-[13px] font-medium text-ink-2">{sub}</p>}
      </div>
      {href && <MoreLink href={href} />}
      {action}
    </div>
  );
}

export function MoreLink({ href, children = "Ver más" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="-mr-3 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-bold text-green-700 transition-colors hover:bg-green-100 [&_svg]:size-4">
      {children}
      <ChevronRight />
    </Link>
  );
}

const avatarTints = ["bg-green-100 text-green-800", "bg-teal-soft text-teal", "bg-warning-soft text-warning", "bg-[#e6eefa] text-[#2f4f86]", "bg-danger-soft text-danger"];

// Initials circle with a tint picked from the name, stable across renders.
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const tint = avatarTints[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarTints.length];
  return <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold", tint, className)}>{initials}</span>;
}

export function Kebab({ label }: { label: string }) {
  return (
    <button type="button" aria-label={label} className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-green-100 hover:text-green-800 [&_svg]:size-[18px]">
      <EllipsisVertical />
    </button>
  );
}

// Filled check badge for feature lists.
export function CheckDot() {
  return (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-green-100 text-green-700 [&_svg]:size-3.5 [&_svg]:stroke-3">
      <Check />
    </span>
  );
}

// Accessible on/off switch in brand colors.
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200", on ? "bg-btn-primary shadow-btn" : "bg-[#dfe6dd]")}
    >
      <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none", on && "translate-x-5")} />
    </button>
  );
}
