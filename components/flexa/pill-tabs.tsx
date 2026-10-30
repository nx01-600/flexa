"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

// Segmented control. The active pill slides between options instead of jumping.
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  full,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  full?: boolean;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto rounded-full bg-green-100/70 p-1 [scrollbar-width:none]", full && "w-full", className)}>
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
              "relative h-8 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150",
              full && "flex-1",
              active ? "text-green-900" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={id}
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
