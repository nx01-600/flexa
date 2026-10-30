"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Brand-styled wrapper over the shadcn Select. Options are plain labels.
export function Choice({
  id,
  options,
  value,
  onChange,
  placeholder = "Selecciona",
  className,
}: {
  id?: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger
        id={id}
        className={cn(
          "h-13 w-full rounded-md border-input bg-surface px-4 text-base text-ink data-placeholder:text-ink-3 focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-200/60",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-md p-1 shadow-lg ring-line">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="h-10 rounded-sm px-3 text-[15px] focus:bg-green-100">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
