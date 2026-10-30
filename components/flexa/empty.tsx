import { Hourglass, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Blob } from "@/components/flexa/shapes";
import { Card, IconBox } from "@/components/flexa/ui";

// For sections whose content Flexa has not defined yet (see proyecto/flexa.md).
export function Pending({ title, text, icon: Icon = Hourglass, action }: { title: string; text: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <Card tone="soft" className="relative isolate flex flex-col items-center gap-3 overflow-hidden px-6 py-16 text-center">
      <Blob shape={0} className="-top-16 -right-16 -z-10 size-[220px] opacity-80" />
      <Blob shape={2} className="-bottom-20 -left-16 -z-10 size-[200px] opacity-70" />
      <IconBox size="lg" halo>
        <Icon />
      </IconBox>
      <h2 className="mt-2 text-h2 text-ink">{title}</h2>
      <p className="max-w-md text-[15px] font-medium text-ink-2">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}
