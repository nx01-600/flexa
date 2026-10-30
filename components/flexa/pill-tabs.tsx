"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

// Tabs with a sliding active state.
// chips: separate rounded chips, active solid green (mobile filters).
// segmented: full-width track with equal segments (desktop sections).
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  full,
  variant = "chips",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  full?: boolean;
  variant?: "chips" | "segmented";
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const chips = variant === "chips";
  return (
    <div
      role="tablist"
      className={cn(
        chips ? "flex gap-2 overflow-x-auto py-1 [scrollbar-width:none]" : "grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-[#eef3ed] p-1",
        (full || !chips) && "w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative shrink-0 text-sm transition-colors duration-150",
              chips
                ? cn("h-9 rounded-full px-4 font-semibold", full && "flex-1", active ? "text-white" : "bg-surface text-ink-2 shadow-xs ring-1 ring-line hover:text-ink")
                : cn("h-10 rounded-sm px-3", active ? "font-bold text-green-900" : "font-semibold text-ink-2 hover:bg-white/60 hover:text-ink"),
            )}
          >
            {active && (
              <motion.span
                layoutId={id}
                className={cn("absolute inset-0", chips ? "rounded-full bg-btn-primary shadow-btn" : "rounded-sm bg-green-200 shadow-xs")}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
