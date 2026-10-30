import { Hourglass } from "lucide-react";
import { Card } from "@/components/flexa/ui";

// For sections whose content Flexa has not defined yet (see proyecto/flexa.md).
export function Pending({ title, text }: { title: string; text: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-green-100 text-green-700">
        <Hourglass className="size-6" />
      </span>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="max-w-md text-sm text-ink-2">{text}</p>
    </Card>
  );
}
