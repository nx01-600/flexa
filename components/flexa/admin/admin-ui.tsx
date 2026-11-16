"use client";

import type { ComponentProps, ReactNode } from "react";
import { Info, TriangleAlert } from "@/components/flexa/icons";
import { Badge, Button, Card, IconBox, inputClass } from "@/components/flexa/ui";
import type { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function PageHeader({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-balance text-ink">{title}</h1>
        <p className="text-[15px] font-medium text-ink-2">{sub}</p>
      </div>
      {action}
    </div>
  );
}

type LoadState<T> = { data: T | null; error: ApiError | null; loading: boolean; reload: () => void };

// Loading / error / empty for a useApi() result; renders children only with data.
export function Async<T>({ state, empty, isEmpty, children }: { state: LoadState<T>; empty?: string; isEmpty?: (d: T) => boolean; children: (d: T) => ReactNode }) {
  const { data, error, loading, reload } = state;
  if (error && !data)
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <IconBox tone="red">
          <TriangleAlert />
        </IconBox>
        <p className="text-[15px] font-bold text-ink">No pudimos cargar esta información</p>
        <p className="max-w-md text-sm font-medium text-ink-2">{error.status === 0 ? "No hay conexión con la API de FLEXA." : error.message}</p>
        <Button size="sm" variant="outline" onClick={reload}>
          Reintentar
        </Button>
      </Card>
    );
  if (!data)
    return (
      <Card className="flex flex-col gap-3 p-6" aria-busy={loading}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-mint-1 motion-reduce:animate-none" />
        ))}
      </Card>
    );
  if (isEmpty?.(data)) return <Empty text={empty ?? "No hay registros."} />;
  return <>{children(data)}</>;
}

export function Empty({ text }: { text: string }) {
  return (
    <Card tone="soft" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <IconBox size="lg" halo>
        <Info />
      </IconBox>
      <p className="max-w-md text-[15px] font-semibold text-ink-2">{text}</p>
    </Card>
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "h-11 cursor-pointer pr-8 text-[15px]", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-3 text-[15px]", className)} {...props} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-danger">
      {children}
    </p>
  );
}

// Inline field for compact forms (filters, edit panels).
export function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-bold text-ink-2", className)}>
      {label}
      {children}
    </label>
  );
}

type Tone = "green" | "amber" | "gray" | "red" | "teal";
const labels: Record<string, [string, Tone]> = {
  ACTIVE: ["Activa", "green"],
  SUSPENDED: ["Suspendida", "red"],
  ONBOARDING: ["En vinculación", "teal"],
  OK: ["Operando", "green"],
  DEGRADED: ["Degradada", "amber"],
  DOWN: ["Caída", "red"],
  NOT_CONFIGURED: ["Sin configurar", "gray"],
  REQUESTED: ["Solicitado", "gray"],
  EXCEPTION: ["En excepción", "amber"],
  APPROVED: ["Aprobado", "teal"],
  DISBURSING: ["Desembolsando", "teal"],
  DISBURSED: ["Desembolsado", "green"],
  REJECTED: ["Rechazado", "red"],
  FAILED: ["Fallido", "red"],
  CANCELLED: ["Cancelado", "gray"],
  OPEN: ["Abierta", "amber"],
  IN_PROGRESS: ["En curso", "teal"],
  ESCALATED: ["Escalada", "red"],
  RESOLVED: ["Resuelta", "green"],
  WAITING_USER: ["Esperando usuario", "gray"],
  CLOSED: ["Cerrada", "gray"],
  COMPENSATED: ["Compensado", "teal"],
  RECONCILED: ["Conciliado", "green"],
  PENDING: ["Pendiente", "gray"],
  WITH_DIFFERENCES: ["Con diferencias", "amber"],
  PROCESSING: ["Procesando", "teal"],
  PROCESSED: ["Procesado", "green"],
  WITH_ISSUES: ["Con inconsistencias", "amber"],
  MANUAL_REVIEW: ["Revisión manual", "amber"],
};

export const statusLabel = (s: string) => labels[s]?.[0] ?? s;

export function Status({ value, label }: { value: string; label?: string }) {
  const [text, tone] = labels[value] ?? [value, "gray"];
  return <Badge tone={tone}>{label ?? text}</Badge>;
}

export const roleLabel: Record<string, string> = {
  WORKER: "Trabajador",
  COMPANY_ADMIN: "Talento Humano",
  COMPANY_FINANCE: "Financiero",
  FLEXA_ADMIN: "FLEXA",
};

export const dateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export type CompanyRow = {
  id: string;
  name: string;
  nit: string;
  status: string;
  pricePerWorker: number;
  integrationType: string;
  integrationStatus: string;
  erpName: string | null;
  lastSyncAt: string | null;
  hasApiKey: boolean;
  enabledWorkers: number;
  monthlyRevenue: number;
  _count: { workers: number };
};

// Company filter shared by list pages.
export function CompanySelect({ companies, value, onChange }: { companies: CompanyRow[] | null; value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label="Empresa">
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-52">
        <option value="">Todas</option>
        {companies?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </Labeled>
  );
}

export const qs = (params: Record<string, string>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return s ? `?${s}` : "";
};

export const ticketStatuses = [
  ["OPEN", "Abierta"],
  ["IN_PROGRESS", "En curso"],
  ["WAITING_USER", "Esperando usuario"],
  ["CLOSED", "Cerrada"],
] as const;
