import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-[filter,background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0";

const buttonVariants = {
  // glossy green gradient; disabled turns solid light green, never a faded primary
  primary: "bg-btn-primary text-white shadow-btn hover:brightness-105 disabled:bg-none disabled:bg-green-300 disabled:shadow-none",
  soft: "bg-green-100 text-green-900 hover:bg-green-200 disabled:opacity-60",
  outline: "border-[1.5px] border-line bg-surface text-ink shadow-xs hover:bg-green-50 disabled:opacity-60",
  danger: "bg-btn-danger text-white shadow-btn-danger hover:brightness-105 disabled:opacity-60",
  "danger-outline": "border-[1.5px] border-danger bg-surface text-danger hover:bg-danger-soft disabled:opacity-60",
  ghost: "text-green-700 hover:bg-green-100 disabled:opacity-60",
};

const buttonSizes = {
  xl: "h-14 px-6 text-[17px]", // desktop login, 56px
  lg: "h-13 px-5 text-base", // mobile, 52px
  md: "h-12 px-5 text-[15px]", // desktop, 48px
  sm: "h-10 rounded-sm px-4 text-sm",
};

type ButtonStyle = {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export function buttonClass({ variant = "primary", size = "lg" }: ButtonStyle = {}, className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}

const cardTones = {
  white: "bg-surface",
  soft: "bg-surface bg-card-soft ring-1 ring-inset ring-white/70", // white to mint
  mint: "bg-mint-2 bg-card-mint", // hero / summary blocks
  green: "bg-surface bg-tint-green",
  teal: "bg-surface bg-tint-teal",
  amber: "bg-surface bg-tint-amber",
  red: "bg-surface bg-tint-red",
};

export type CardTone = keyof typeof cardTones;

// Elevation is shadow only, no border. Radius 20px.
export function Card({ tone = "white", className, ...props }: ComponentProps<"div"> & { tone?: CardTone }) {
  return <div className={cn("rounded-lg shadow-card", cardTones[tone], className)} {...props} />;
}

// Card heading row with an optional trailing action ("Ver más").
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-h3 text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Field({ label, htmlFor, children, hint, hideLabel }: { label: string; htmlFor: string; children: ReactNode; hint?: string; hideLabel?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={cn("text-sm font-semibold text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] font-medium text-ink-3">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "h-13 w-full rounded-md border-[1.5px] border-input bg-surface px-4 text-base font-medium text-ink shadow-xs placeholder:font-medium placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-200/70 aria-invalid:border-danger";

// Text input. `icon` adds a leading glyph, `end` a trailing slot (eye toggle, unit).
export function Input({ className, icon: Icon, end, ...props }: ComponentProps<"input"> & { icon?: LucideIcon; end?: ReactNode }) {
  if (!Icon && !end) return <input className={cn(inputClass, className)} {...props} />;
  return (
    <div className="relative">
      {Icon && <Icon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" />}
      <input className={cn(inputClass, Icon && "pl-12", end && "pr-12", className)} {...props} />
      {end && <div className="absolute inset-y-0 right-1 flex items-center">{end}</div>}
    </div>
  );
}

const badgeTones = {
  green: "bg-[#ddf0da] text-[#1f6b2e]",
  amber: "bg-warning-soft text-warning",
  gray: "bg-[#eef2ec] text-ink-2",
  red: "bg-danger-soft text-danger",
  teal: "bg-teal-soft text-teal",
};

export function Badge({ tone = "green", className, ...props }: ComponentProps<"span"> & { tone?: keyof typeof badgeTones }) {
  return <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-bold whitespace-nowrap", badgeTones[tone], className)} {...props} />;
}

const iconTones = {
  green: "bg-[#e2f2de] text-green-600",
  red: "bg-danger-soft text-danger",
  amber: "bg-warning-soft text-warning-icon",
  teal: "bg-teal-soft text-teal",
  gray: "bg-[#eef2ec] text-ink-2",
  white: "bg-surface text-green-600 shadow-sm",
  dark: "bg-green-700 text-white",
  solid: "bg-btn-primary text-white shadow-btn",
};

const iconSizes = {
  sm: "size-9 [&_svg]:size-[18px]", // 36px, list rows
  md: "size-11 [&_svg]:size-[22px]", // 44px, default
  lg: "size-14 [&_svg]:size-[26px]", // 56px, headers and tiles
  xl: "size-[72px] [&_svg]:size-9 [&_svg]:stroke-[2.75]", // 72px, success / hero
};

export type IconTone = keyof typeof iconTones;

// Icon inside a filled soft circle. `halo` adds an outer soft ring.
export function IconBox({
  tone = "green",
  size = "md",
  halo,
  className,
  children,
}: {
  tone?: IconTone;
  size?: keyof typeof iconSizes;
  halo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", iconSizes[size], iconTones[tone], halo && "ring-8 ring-mint-1", className)}>
      {children}
    </span>
  );
}

const statTones = {
  green: ["green", "green"],
  teal: ["teal", "teal"],
  amber: ["amber", "amber"],
  red: ["red", "red"],
  white: ["soft", "green"],
} as const;

// KPI tile: tinted gradient card, icon circle, label and a heavy number.
// `row` puts the icon beside the text (desktop KPI strips).
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "green",
  row,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof statTones;
  row?: boolean;
  className?: string;
}) {
  const [card, icon] = statTones[tone];
  return (
    <Card tone={card} className={cn("flex gap-3 p-5", row ? "items-center gap-4" : "flex-col", className)}>
      <IconBox tone={icon} size={row ? "lg" : "md"}>
        <Icon />
      </IconBox>
      <div className="flex min-w-0 flex-col gap-0.5">
        {row ? (
          <>
            <span className="text-money text-ink tabular-nums">{value}</span>
            <span className="text-[13px] font-semibold text-ink-2">{label}</span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-ink-2">{label}</span>
            <span className="text-[22px] leading-tight font-extrabold tracking-[-0.03em] text-ink tabular-nums">{value}</span>
          </>
        )}
        {hint && <span className="text-xs font-semibold text-ink-3">{hint}</span>}
      </div>
    </Card>
  );
}
