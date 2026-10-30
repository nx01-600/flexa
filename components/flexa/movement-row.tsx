import Link from "next/link";
import { ArrowUpRight, ChevronRight, Smartphone, Wifi, Zap } from "lucide-react";
import { IconBox } from "@/components/flexa/ui";
import { money, type Movement } from "@/lib/mock";
import { cn } from "@/lib/utils";

function iconFor(m: Movement) {
  if (m.kind === "retiro") return ArrowUpRight;
  if (m.kind === "recarga") return Smartphone;
  return /internet/i.test(m.title) ? Wifi : Zap;
}

// 68px row. `divider` draws a hairline inset to the text column (72px), not under the icon.
export function MovementRow({ m, divider }: { m: Movement; divider?: boolean }) {
  const Icon = iconFor(m);
  return (
    <Link href={`/app/comprobante?id=${m.id}`} className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70">
      <IconBox tone={m.kind === "retiro" ? "red" : "green"}>
        <Icon />
      </IconBox>
      <span className={cn("flex min-h-[68px] min-w-0 flex-1 items-center gap-2 pr-3", divider && "border-t border-line-soft")}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold text-ink">{m.title}</span>
          <span className="text-[13px] font-medium text-ink-3">{m.date}</span>
        </span>
        <span className="text-[15px] font-bold text-danger tabular-nums">−{money(m.amount)}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
