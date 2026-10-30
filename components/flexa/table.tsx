import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Header row sits on a soft tinted band; rows are 56px with faint dividers.
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-separate border-spacing-0 text-left text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("h-11 bg-head px-4 text-[13px] font-bold whitespace-nowrap text-ink-2 first:rounded-l-md last:rounded-r-md", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("h-14 border-b border-line-soft px-4 font-medium whitespace-nowrap text-ink [tr:last-child>&]:border-0", className)} {...props} />;
}
