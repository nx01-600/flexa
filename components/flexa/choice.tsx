"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IconType } from "@/components/flexa/icons";
import { cn } from "@/lib/utils";

// Brand-styled wrapper over the shadcn Select. Options are plain labels.
export function Choice({
  id,
  options,
  value,
  onChange,
  placeholder = "Selecciona",
  icon: Icon,
  className,
}: {
  id?: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: IconType; // leading glyph, e.g. Calendar on period pickers
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger
        id={id}
        className={cn(
          "h-13 w-full gap-2.5 rounded-md border-[1.5px] border-input bg-surface px-4 text-base font-medium text-ink shadow-xs transition-[border-color,box-shadow] data-placeholder:text-ink-3 focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-200/70 [&>svg:last-child]:size-5 [&>svg:last-child]:text-ink-2",
          className,
        )}
      >
        {Icon && <Icon aria-hidden className="size-5 text-green-600" />}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-md p-1.5 shadow-lg ring-line">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="h-11 rounded-sm px-3 text-[15px] font-medium focus:bg-green-100 focus:text-green-900">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
