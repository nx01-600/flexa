"use client";

import { useState } from "react";
import { Choice } from "@/components/flexa/choice";

export function Period({ options }: { options: string[] }) {
  const [v, setV] = useState(options[0]);
  return <Choice options={options} value={v} onChange={setV} className="h-11 w-48 text-sm font-semibold" />;
}
