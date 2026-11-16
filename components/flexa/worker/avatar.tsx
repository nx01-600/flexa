"use client";

import Image from "next/image";
import { useState } from "react";
import { photo } from "@/lib/mock";
import { cn } from "@/lib/utils";

// Sample portrait when one exists for the name, otherwise the initials on mint.
export function Avatar({ name, size, className, priority }: { name: string; size: number; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  if (failed || !name)
    return (
      <span aria-hidden className={cn("grid place-items-center rounded-full bg-green-200 font-extrabold text-green-900", className)} style={{ fontSize: size * 0.36 }}>
        {initials}
      </span>
    );
  return <Image src={photo(name)} alt="" width={size * 2} height={size * 2} priority={priority} onError={() => setFailed(true)} className={cn("rounded-full object-cover", className)} />;
}
