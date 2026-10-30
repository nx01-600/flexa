import Link from "next/link";
import { ArrowUpRight, ChevronRight, Smartphone, Zap } from "lucide-react";
import { IconBox } from "@/components/flexa/ui";
import { money, type Movement } from "@/lib/mock";

const icons = { retiro: ArrowUpRight, pago: Zap, recarga: Smartphone };

export function MovementRow({ m }: { m: Movement }) {
  const Icon = icons[m.kind];
  return (
    <Link
      href={`/app/comprobante?id=${m.id}`}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-green-50"
    >
      <IconBox tone={m.kind === "retiro" ? "green" : "amber"}>
        <Icon />
      </IconBox>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold text-ink">{m.title}</span>
        <span className="text-xs text-ink-3">{m.date}</span>
      </span>
      <span className="text-[15px] font-bold text-ink tabular-nums">−{money(m.amount)}</span>
      <ChevronRight className="size-4 text-ink-3" />
    </Link>
  );
}
