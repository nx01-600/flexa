import Link from "next/link";
import { ArrowUpRight, ChevronRight, Smartphone, Wifi, Zap } from "@/components/flexa/icons";
import { IconBox } from "@/components/flexa/ui";
import { statusOf, type Movement } from "@/components/flexa/worker/types";
import { dateFmt, money } from "@/lib/api";
import { cn } from "@/lib/utils";

function iconFor(m: Movement) {
  if (m.kind === "retiro") return <ArrowUpRight />;
  if (m.kind === "recarga") return <Smartphone />;
  return /internet|claro|tigo|movistar/i.test(m.title) ? <Wifi /> : <Zap />;
}

const SETTLED = ["DISBURSED", "COMPLETED"];

// 68px row. `divider` draws a hairline inset to the text column (72px), not under the icon.
// Settled movements open the receipt; retiros still in flight open the request timeline.
export function MovementRow({ m, divider }: { m: Movement; divider?: boolean }) {
  const settled = SETTLED.includes(m.status);
  const st = statusOf(m.status);
  const href = settled || m.kind !== "retiro" ? `/app/comprobante/${m.code}` : `/app/solicitudes/${m.id}`;
  return (
    <Link href={href} className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70">
      <IconBox tone={m.kind === "retiro" ? "red" : "green"}>
        {iconFor(m)}
      </IconBox>
      <span className={cn("flex min-h-[68px] min-w-0 flex-1 items-center gap-2 pr-3", divider && "border-t border-line-soft")}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold text-ink">{m.title}</span>
          <span className="truncate text-[13px] font-medium text-ink-3">
            {dateFmt(m.date)}
            {!settled && <span className={cn("font-bold", st.tone === "red" ? "text-danger" : st.tone === "gray" ? "text-ink-2" : "text-warning")}> · {st.label}</span>}
          </span>
        </span>
        <span className={cn("text-[15px] font-bold tabular-nums", ["CANCELLED", "REJECTED", "FAILED"].includes(m.status) ? "text-ink-3 line-through" : "text-danger")}>
          −{money(m.amount)}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
