"use client";

import type { ReactNode } from "react";
import { Info, TriangleAlert, WifiHigh, type IconType } from "@/components/flexa/worker/icons";
import { Blob } from "@/components/flexa/shapes";
import { Button, Card, IconBox } from "@/components/flexa/ui";
import type { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// Loading, empty and error states shared by the worker screens.

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-green-100/70 motion-reduce:animate-none", className)} />;
}

// Card-shaped placeholders while a section loads.
export function LoadingCards({ count = 2, label = "Cargando" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} tone="soft" className="flex flex-col gap-3 p-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </Card>
      ))}
    </div>
  );
}

// List rows placeholder (movements, requests, tickets).
export function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <Card tone="soft" role="status" aria-label="Cargando" className="overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn("flex items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-line-soft")}>
          <Skeleton className="size-11 rounded-full" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </span>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </Card>
  );
}

export function ErrorState({ error, onRetry, title = "No pudimos cargar esta información" }: { error: ApiError | Error | null; onRetry?: () => void; title?: string }) {
  const offline = error && "status" in error && error.status === 0;
  return (
    <Card tone="red" role="alert" className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <IconBox tone="red" size="lg">
        {offline ? <WifiHigh /> : <TriangleAlert />}
      </IconBox>
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 text-ink">{offline ? "Sin conexión con FLEXA" : title}</h2>
        <p className="text-sm font-medium text-ink-2">{offline ? "Revisa tu conexión a internet e intenta de nuevo." : error?.message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: IconType; title: string; text: string; action?: ReactNode }) {
  return (
    <Card tone="soft" className="relative isolate flex flex-col items-center gap-3 overflow-hidden px-6 py-10 text-center">
      <Blob shape={0} className="-top-16 -right-16 -z-10 size-[200px] opacity-70" />
      <IconBox size="lg" halo>
        <Icon />
      </IconBox>
      <h2 className="mt-1 text-h3 text-ink">{title}</h2>
      <p className="max-w-[30ch] text-sm font-medium text-ink-2">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}

// Inline message inside a card or form: errors, warnings, info.
export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "error"; title?: string; children: ReactNode; className?: string }) {
  const styles = {
    info: "bg-teal-soft/70 ring-teal/15 [&_.ico]:text-teal",
    warning: "bg-[#fff8e6] ring-[#f5e2ad] [&_.ico]:text-warning-icon",
    error: "bg-danger-soft/70 ring-danger/20 [&_.ico]:text-danger",
  }[tone];
  const Icon = tone === "info" ? Info : TriangleAlert;
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cn("flex gap-3 rounded-md p-3.5 ring-1 ring-inset", styles, className)}>
      <Icon weight="fill" aria-hidden className="ico mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1 text-sm font-medium text-ink">
        {title && <span className="font-bold">{title}</span>}
        {children}
      </div>
    </div>
  );
}
