import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0";

const buttonVariants = {
  primary: "bg-green-600 text-white shadow-sm hover:bg-green-700",
  soft: "bg-green-100 text-green-900 hover:bg-green-200",
  outline: "border border-line bg-surface text-ink hover:bg-green-50",
  danger: "bg-danger text-white hover:bg-[#b23434]",
  "danger-outline": "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
  ghost: "text-green-700 hover:bg-green-100",
};

const buttonSizes = {
  lg: "h-13 px-5 text-base", // mobile, 52px
  md: "h-11 px-4 text-sm", // desktop, 44px
  sm: "h-9 px-3 text-sm",
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

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "h-13 w-full rounded-md border border-input bg-surface px-4 text-base text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-200/60 aria-invalid:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Badge({ tone = "green", className, ...props }: ComponentProps<"span"> & { tone?: "green" | "amber" | "gray" | "red" }) {
  const tones = {
    green: "bg-green-100 text-green-700",
    amber: "bg-warning-soft text-warning",
    gray: "bg-[#eef1ee] text-ink-2",
    red: "bg-danger-soft text-danger",
  };
  return <span className={cn("inline-flex h-6 items-center rounded-sm px-2 text-xs font-bold", tones[tone], className)} {...props} />;
}

// Rounded square icon holder used across lists and KPIs.
export function IconBox({ tone = "green", className, children }: { tone?: "green" | "red" | "amber" | "dark"; className?: string; children: ReactNode }) {
  const tones = {
    green: "bg-green-100 text-green-700",
    red: "bg-danger-soft text-danger",
    amber: "bg-warning-soft text-warning",
    dark: "bg-green-900 text-green-200",
  };
  return <span className={cn("grid size-10 shrink-0 place-items-center rounded-md [&_svg]:size-5", tones[tone], className)}>{children}</span>;
}
