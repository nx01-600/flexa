"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { CircleHelp, CloudUpload, Info, Search, TriangleAlert, X, type IconType } from "@/components/flexa/icons";
import { Badge, Button, Card, IconBox, inputClass } from "@/components/flexa/ui";
import { ApiError, getSession, type Session } from "@/lib/api";
import { cn } from "@/lib/utils";

// Shared building blocks for the Flexa Empresas panel pages wired to the API.

// ---------- Session / role ----------

const noop = () => () => {};
let cached: { raw: string | null; s: Session | null } = { raw: null, s: null };

// Reads the company session from localStorage without hydration mismatches.
export function useCompanySession() {
  return useSyncExternalStore(
    noop,
    () => {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem("flexa.session.company") : null;
      if (raw !== cached.raw) cached = { raw, s: getSession("company") };
      return cached.s;
    },
    () => null,
  );
}

// False during SSR and hydration, true once on the client.
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

// COMPANY_FINANCE is read-only on operations.
export function useCanWrite() {
  return useCompanySession()?.user.role === "COMPANY_ADMIN";
}

export const roleLabel: Record<string, string> = {
  COMPANY_ADMIN: "Administrador",
  COMPANY_FINANCE: "Financiero",
  WORKER: "Trabajador",
  FLEXA_ADMIN: "Administrador Flexa",
};

// ---------- URL state ----------

// A single search param as state (tabs, filters). Pages using it render inside <Suspense>.
export function useQueryState(key: string, fallback = "") {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const value = sp.get(key) ?? fallback;
  const set = useCallback(
    (next: string) => {
      const p = new URLSearchParams(sp.toString());
      if (next === fallback || !next) p.delete(key);
      else p.set(key, next);
      const qs = p.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [sp, router, path, key, fallback],
  );
  return [value, set] as const;
}

// ---------- States ----------

export function Loading({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Cargando" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-mint-1 motion-reduce:animate-none" style={{ opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 w-full max-w-80 animate-pulse rounded-md bg-mint-1 motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-lg bg-mint-1 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-mint-1 motion-reduce:animate-none" />
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: ApiError | Error | null; onRetry?: () => void; className?: string }) {
  if (!error) return null;
  const offline = error instanceof ApiError && error.status === 0;
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-4 rounded-md bg-danger-soft/60 p-4 lg:flex-nowrap", className)}>
      <IconBox tone="red" size="sm"><TriangleAlert /></IconBox>
      <div className="flex min-w-48 flex-1 flex-col lg:min-w-auto">
        <span className="text-[15px] font-bold text-ink">{offline ? "No pudimos conectar con Flexa" : "No pudimos cargar esta información"}</span>
        <span className="text-[13px] font-medium text-ink-2">{offline ? "Revisa tu conexión e intenta de nuevo." : error.message}</span>
      </div>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, text, action, className }: { icon?: IconType; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <IconBox size="md" halo><Icon /></IconBox>
      <p className="mt-2 text-[15px] font-bold text-ink">{title}</p>
      {text && <p className="max-w-sm text-[13px] font-medium text-ink-2">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Inline feedback after an action.
export function Notice({ tone = "green", children, onClose }: { tone?: "green" | "red" | "amber"; children: ReactNode; onClose?: () => void }) {
  const styles = { green: "bg-green-100 text-green-900", red: "bg-danger-soft text-danger", amber: "bg-warning-soft text-warning" };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-md px-4 py-3 text-sm font-semibold", styles[tone])}>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button type="button" aria-label="Cerrar aviso" onClick={onClose} className="-m-1 grid size-7 place-items-center rounded-full hover:bg-white/60 [&_svg]:size-4">
          <X />
        </button>
      )}
    </div>
  );
}

// Note shown to read-only users instead of write actions.
export function ReadOnlyHint({ children = "Tu rol es de consulta. Solo el administrador puede hacer cambios." }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-3 [&_svg]:size-4">
      <CircleHelp />
      {children}
    </p>
  );
}

// ---------- Async action helper ----------

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Intenta de nuevo.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

// ---------- Form controls ----------

export const fieldClass = cn(inputClass, "h-11 text-[15px]");

export function FormField({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-[13px] font-medium text-ink-3">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-3 text-[15px]", className)} {...props} />;
}

export function Select({ className, options, placeholder, ...props }: ComponentProps<"select"> & { options: readonly { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select className={cn(fieldClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 256 256%22><path fill=%22%234f5b55%22 d=%22M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z%22/></svg>')] bg-[position:right_14px_center] bg-no-repeat pr-10", className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("relative min-w-[min(16rem,100%)] flex-1", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border-[1.5px] border-input bg-surface pr-4 pl-12 text-[15px] font-medium text-ink shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-ink-3 focus:border-green-500 focus:ring-4 focus:ring-green-200/70"
      />
    </label>
  );
}

// File picker styled as a drop target. Keeps the chosen file in parent state.
export function FilePick({ file, onFile, accept = ".csv,text/csv", hint }: { file: File | null; onFile: (f: File | null) => void; accept?: string; hint?: string }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0] ?? null);
      }}
      className={cn(
        "flex cursor-pointer items-center gap-4 rounded-md border-[1.5px] border-dashed p-4 transition-colors focus-within:ring-4 focus-within:ring-green-200/70",
        over ? "border-green-500 bg-green-50" : "border-green-300 bg-mint-1 hover:bg-green-50",
      )}
    >
      <IconBox tone="white" size="sm"><CloudUpload /></IconBox>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold text-ink">{file ? file.name : "Elige o arrastra un archivo CSV"}</span>
        <span className="text-[13px] font-medium text-ink-2">{file ? `${(file.size / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} KB` : hint}</span>
      </span>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

// ---------- Dialog ----------

// Native <dialog>: focus trap, Esc and backdrop for free.
export function Dialog({
  open,
  onClose,
  title,
  sub,
  children,
  onSubmit,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-y-auto rounded-xl bg-surface p-0 text-ink shadow-raised backdrop:bg-green-900/30 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 open:zoom-in-95 motion-reduce:open:animate-none",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          if (!onSubmit) return;
          e.preventDefault();
          onSubmit(e);
        }}
        className="flex flex-col gap-5 p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-h2 text-ink">{title}</h2>
            {sub && <p className="text-sm font-medium text-ink-2">{sub}</p>}
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-green-100 [&_svg]:size-5">
            <X />
          </button>
        </div>
        {children}
        {footer && <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">{footer}</div>}
      </form>
    </dialog>
  );
}

// Confirmation with optional required note.
export function ConfirmDialog({
  open,
  onClose,
  title,
  text,
  confirm,
  danger,
  note,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: ReactNode;
  confirm: string;
  danger?: boolean;
  note?: { label: string; placeholder?: string; min?: number };
  onConfirm: (note: string) => Promise<unknown> | unknown;
}) {
  const [value, setValue] = useState("");
  const { busy, error, run } = useAction();
  const tooShort = !!note && value.trim().length < (note.min ?? 3);
  return (
    <Dialog
      open={open}
      onClose={() => (setValue(""), onClose())}
      title={title}
      onSubmit={async () => {
        const ok = await run(async () => {
          await onConfirm(value.trim());
          return true;
        });
        if (ok) {
          setValue("");
          onClose();
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} size="sm" disabled={busy || tooShort}>{busy ? "Procesando…" : confirm}</Button>
        </>
      }
    >
      <div className="text-[15px] font-medium text-ink-2">{text}</div>
      {note && (
        <FormField label={note.label}>
          <TextArea value={value} onChange={(e) => setValue(e.target.value)} placeholder={note.placeholder} required />
        </FormField>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Dialog>
  );
}

// ---------- Status vocabularies ----------

type Tone = "green" | "amber" | "gray" | "red" | "teal";
const make = (m: Record<string, [string, Tone]>) =>
  function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
    const [label, tone] = (value && m[value]) || [value ?? "—", "gray" as Tone];
    return <Badge tone={tone} className={className}>{label}</Badge>;
  };

export const advanceStatus: Record<string, [string, Tone]> = {
  REQUESTED: ["Solicitada", "teal"],
  EXCEPTION: ["En excepción", "amber"],
  APPROVED: ["Aprobada", "teal"],
  DISBURSING: ["Desembolsando", "teal"],
  DISBURSED: ["Desembolsada", "green"],
  REJECTED: ["Rechazada", "red"],
  FAILED: ["Fallida", "red"],
  CANCELLED: ["Cancelada", "gray"],
};
export const AdvanceBadge = make(advanceStatus);

export const workerStatus: Record<string, [string, Tone]> = {
  INVITED: ["Invitado", "teal"],
  PENDING_KYC: ["Validando identidad", "amber"],
  ACTIVE: ["Activo", "green"],
  DISABLED: ["Deshabilitado", "gray"],
  RETIRED: ["Retirado", "red"],
};
export const WorkerBadge = make(workerStatus);

export const KycBadge = make({
  NOT_STARTED: ["Sin iniciar", "gray"],
  PENDING: ["Pendiente", "amber"],
  APPROVED: ["Aprobado", "green"],
  REJECTED: ["Rechazado", "red"],
  MANUAL_REVIEW: ["Revisión manual", "amber"],
});

export const periodStatus: Record<string, [string, Tone]> = {
  OPEN: ["Abierto", "teal"],
  CLOSED: ["Cerrado", "amber"],
  COMPENSATED: ["Compensado", "amber"],
  RECONCILED: ["Conciliado", "green"],
};
export const PeriodBadge = make(periodStatus);

export const UploadBadge = make({
  PROCESSING: ["Procesando", "teal"],
  PROCESSED: ["Procesada", "green"],
  WITH_ISSUES: ["Con inconsistencias", "amber"],
  FAILED: ["Fallida", "red"],
});

export const LineBadge = make({
  PENDING: ["Pendiente", "gray"],
  APPLIED: ["Aplicado", "green"],
  PARTIAL: ["Parcial", "amber"],
  DIFFERENCE: ["Diferencia", "red"],
});

export const ReconBadge = make({
  PENDING: ["Pendiente", "gray"],
  IN_PROGRESS: ["En curso", "teal"],
  WITH_DIFFERENCES: ["Con diferencias", "amber"],
  RECONCILED: ["Conciliado", "green"],
});

export const incidentStatus: Record<string, [string, Tone]> = {
  OPEN: ["Abierta", "amber"],
  IN_PROGRESS: ["En gestión", "teal"],
  ESCALATED: ["Escalada", "red"],
  RESOLVED: ["Resuelta", "green"],
};
export const IncidentBadge = make(incidentStatus);

export const ticketStatus: Record<string, [string, Tone]> = {
  OPEN: ["Abierta", "amber"],
  IN_PROGRESS: ["En gestión", "teal"],
  WAITING_USER: ["Esperando respuesta", "teal"],
  CLOSED: ["Cerrada", "gray"],
};
export const TicketBadge = make(ticketStatus);

export const IntegrationBadge = make({
  OK: ["Operando", "green"],
  DEGRADED: ["Con fallas", "amber"],
  DOWN: ["Caída", "red"],
  NOT_CONFIGURED: ["Sin configurar", "gray"],
});

export const incidentCategories: Record<string, string> = {
  ADVANCE_EXCEPTION: "Excepción de solicitud",
  DISBURSEMENT_FAILED: "Desembolso fallido",
  RECONCILIATION: "Conciliación",
  PAYROLL_DATA: "Datos de nómina",
  WORKER: "Trabajador",
  OTHER: "Otra",
};

export const noveltyTypes: Record<string, string> = {
  INCAPACIDAD: "Incapacidad",
  VACACIONES: "Vacaciones",
  AUSENCIA: "Ausencia",
  LICENCIA_NO_REMUNERADA: "Licencia no remunerada",
  RETIRO: "Retiro",
  AJUSTE_SALARIO: "Ajuste de salario",
  HORAS_EXTRA: "Horas extra",
  RECARGO: "Recargo",
};

export const contractTypes = ["INDEFINIDO", "FIJO", "OBRA_LABOR", "APRENDIZAJE"].map((v) => ({ value: v, label: v.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) }));

// ---------- Small layout pieces ----------

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("flex min-w-0 flex-col gap-4 p-4 sm:p-6 lg:min-w-auto", className)}>{children}</Card>;
}

// Label / value list used on detail pages.
export function Facts({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-4 sm:gap-x-6", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 xl:grid-cols-4")}>
      {items.map(([k, v]) => (
        <div key={k} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
          {/* Wraps on small screens so values stay readable; truncates from lg. */}
          <dd className="text-[15px] font-bold break-words text-ink tabular-nums lg:truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const pct = (n: number | null | undefined, digits = 1) => `${(n ?? 0).toLocaleString("es-CO", { maximumFractionDigits: digits })}%`;

export const dateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

// "2026-11-16" for <input type=date>.
export const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

// Signed change chip: green when the change is good.
export function Delta({ value, goodWhenUp = true, suffix = "%" }: { value: number | null | undefined; goodWhenUp?: boolean; suffix?: string }) {
  const v = value ?? 0;
  const good = v === 0 ? null : v > 0 === goodWhenUp;
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-xs font-bold tabular-nums", good === null ? "bg-[#eef2ec] text-ink-2" : good ? "bg-green-100 text-green-700" : "bg-warning-soft text-warning")}>
      {v > 0 ? "+" : ""}
      {v.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
      {suffix}
    </span>
  );
}
