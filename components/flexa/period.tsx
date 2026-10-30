"use client";

import { Calendar } from "lucide-react";
import { useState } from "react";
import { Choice } from "@/components/flexa/choice";

export function Period({ options }: { options: string[] }) {
  const [v, setV] = useState(options[0]);
  return <Choice options={options} value={v} onChange={setV} icon={Calendar} className="h-11 w-56 data-[size=default]:h-11 shrink-0 text-sm font-semibold shadow-sm" />;
}
