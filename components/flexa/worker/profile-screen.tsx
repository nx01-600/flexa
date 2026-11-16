"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Building2, Check, ChevronRight, CircleHelp, FileText, LogOut, Plus, Receipt, Star, Trash } from "@/components/flexa/worker/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Backdrop } from "@/components/flexa/shapes";
import { AccountForm } from "@/components/flexa/worker/account-form";
import { Avatar } from "@/components/flexa/worker/avatar";
import { EmptyState, ErrorState, LoadingCards, LoadingRows, Notice, Skeleton } from "@/components/flexa/worker/states";
import { accountTypeLabel, stamp, type Account, type LegalDoc, type Profile, type WorkerDocument } from "@/components/flexa/worker/types";
import { Badge, Button, Card, Field, IconBox, Input } from "@/components/flexa/ui";
import { api, ApiError, dateFmt, logout, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const views = [
  { value: "datos", label: "Mis datos" },
  { value: "cuentas", label: "Cuentas" },
  { value: "documentos", label: "Documentos" },
] as const;
type View = (typeof views)[number]["value"];

const kycBadge: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  APPROVED: { label: "Identidad verificada", tone: "green" },
  MANUAL_REVIEW: { label: "Identidad en revisión", tone: "amber" },
  REJECTED: { label: "Identidad no validada", tone: "red" },
  NOT_STARTED: { label: "Identidad sin validar", tone: "gray" },
};

const contract: Record<string, string> = { INDEFINIDO: "Término indefinido", FIJO: "Término fijo", OBRA_LABOR: "Obra o labor", APRENDIZAJE: "Aprendizaje" };

export function ProfileScreen() {
  const router = useRouter();
  const path = usePathname();
  const q = useSearchParams().get("vista");
  const view: View = views.some((v) => v.value === q) ? (q as View) : "datos";
  const profile = useApi<Profile>("/worker/profile");
  const p = profile.data;
  const kyc = p ? (kycBadge[p.kycStatus] ?? kycBadge.NOT_STARTED) : null;

  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Mi perfil" />
      <main className="flex flex-col gap-5 px-5 pt-3">
        <section className="flex flex-col items-center gap-3 text-center">
          <span className="size-[88px] overflow-hidden rounded-full shadow-card ring-[5px] ring-white">
            {p ? <Avatar name={`${p.firstName} ${p.lastName}`} size={88} priority className="size-full" /> : <Skeleton className="size-full rounded-full" />}
          </span>
          {p ? (
            <div className="flex flex-col items-center gap-0.5">
              <h2 className="text-h2 text-ink">
                {p.firstName} {p.lastName}
              </h2>
              <span className="text-sm font-semibold text-ink-2 tabular-nums">
                {p.docType} {Number(p.docNumber).toLocaleString("es-CO")} · {p.company.name}
              </span>
              {kyc && (
                <Badge tone={kyc.tone} className="mt-2">
                  {kyc.label}
                </Badge>
              )}
              {!p.onboarding.complete && (
                <Link href="/app/onboarding" className="mt-2 text-sm font-bold text-green-700 underline underline-offset-4">
                  Completar registro
                </Link>
              )}
            </div>
          ) : profile.error ? null : (
            <Skeleton className="h-6 w-48" />
          )}
        </section>

        {profile.error && <ErrorState error={profile.error} onRetry={profile.reload} />}

        <PillTabs variant="segmented" options={views} value={view} onChange={(v) => router.replace(v === "datos" ? path : `${path}?vista=${v}`, { scroll: false })} />

        {view === "datos" && p && <PersonalData profile={p} onSaved={profile.reload} />}
        {view === "datos" && !p && profile.loading && <LoadingCards count={2} />}
        {view === "cuentas" && <Accounts />}
        {view === "documentos" && <Documents />}

        <Card tone="soft" className="overflow-hidden">
          <Link href="/app/ayuda" className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70">
            <IconBox size="sm">
              <CircleHelp />
            </IconBox>
            <span className="flex min-h-[60px] flex-1 items-center gap-3 pr-4 text-[15px] font-bold text-ink">
              <span className="flex-1">Ayuda y soporte</span>
              <ChevronRight aria-hidden className="size-[18px] text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </span>
          </Link>
          <button type="button" onClick={() => logout("worker")} className="flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-danger-soft/50">
            <IconBox tone="red" size="sm">
              <LogOut />
            </IconBox>
            <span className="flex min-h-[60px] flex-1 items-center border-t border-line-soft pr-4 text-[15px] font-bold text-danger">Cerrar sesión</span>
          </button>
        </Card>
      </main>
    </>
  );
}

function PersonalData({ profile: p, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [email, setEmail] = useState(p.email);
  const [phone, setPhone] = useState(p.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = email.trim() !== p.email || phone.trim() !== (p.phone ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/worker/profile", { method: "PATCH", body: { email: email.trim(), phone: phone.replace(/\D/g, "") } });
      setMsg({ ok: true, text: "Guardamos tus datos." });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "No pudimos guardar tus datos." });
    } finally {
      setBusy(false);
    }
  };

  const info: [string, string][] = [
    ["Cargo", p.position ?? "—"],
    ["Sede", p.site ? `${p.site.name}` : "—"],
    ["Contrato", p.contractType ? (contract[p.contractType] ?? p.contractType) : "—"],
    ["Fecha de ingreso", dateFmt(p.hireDate)],
    ["Salario base", money(p.baseSalary)],
    ["NIT empresa", p.company.nit],
  ];

  return (
    <>
      <Card tone="soft" className="p-5">
        <form onSubmit={save} className="flex flex-col gap-4">
          <h3 className="text-h3 text-ink">Contacto</h3>
          <Field label="Correo electrónico" htmlFor="pf-email" hint="También lo usas para iniciar sesión.">
            <Input id="pf-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Celular" htmlFor="pf-phone">
            <Input id="pf-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {msg && <Notice tone={msg.ok ? "info" : "error"}>{msg.text}</Notice>}
          <Button type="submit" variant="soft" disabled={!dirty || busy}>
            {busy ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </Card>
      <Card tone="soft" className="px-5 py-2">
        <h3 className="pt-3 pb-1 text-h3 text-ink">Información laboral</h3>
        <dl>
          {info.map(([k, v], i) => (
            <div key={k} className={cn("flex min-h-11 items-center justify-between gap-4 py-2", i > 0 && "border-t border-line-soft")}>
              <dt className="text-sm font-medium text-ink-2">{k}</dt>
              <dd className="text-right text-sm font-bold text-ink tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="pb-3 text-xs font-medium text-ink-3">Si algo no coincide, pide a Talento Humano que lo actualice.</p>
      </Card>
    </>
  );
}

function Accounts() {
  const { data, error, loading, reload } = useApi<Account[]>("/worker/accounts");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setActionError(null);
    try {
      await fn();
      setConfirmDelete(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "No pudimos actualizar la cuenta.");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) return <LoadingRows count={2} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const list = data ?? [];

  return (
    <>
      {list.length === 0 && !adding && (
        <EmptyState icon={Building2} title="Sin cuentas registradas" text="Agrega la cuenta o billetera donde quieres recibir tus retiros." />
      )}
      {list.length > 0 && (
        <Card tone="soft" className="overflow-hidden">
          {list.map((a, i) => (
            <div key={a.id} className={cn("flex flex-col gap-3 p-4", i > 0 && "border-t border-line-soft")}>
              <div className="flex items-center gap-3">
                <IconBox size="sm" tone={a.isDefault ? "dark" : "green"}>
                  <Building2 />
                </IconBox>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-[15px] font-bold text-ink">
                    {a.bank}
                    {a.isDefault && (
                      <Badge className="h-5 px-2 text-[11px]">
                        <Check weight="bold" className="mr-0.5 size-3" />
                        Principal
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-[13px] font-medium text-ink-3 tabular-nums">
                    {accountTypeLabel[a.type]} · {a.number}
                  </span>
                </span>
              </div>
              {confirmDelete === a.id ? (
                <div className="flex flex-col gap-2 rounded-md bg-danger-soft/60 p-3">
                  <p className="text-sm font-semibold text-ink">¿Eliminar esta cuenta? Ya no podrás recibir retiros en ella.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy === a.id} onClick={() => act(a.id, () => api(`/worker/accounts/${a.id}`, { method: "DELETE" }))}>
                      {busy === a.id ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pl-12">
                  {!a.isDefault && (
                    <Button size="sm" variant="soft" className="h-9" disabled={busy === a.id} onClick={() => act(a.id, () => api(`/worker/accounts/${a.id}/default`, { method: "POST" }))}>
                      <Star />
                      Hacer principal
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-9 text-danger hover:bg-danger-soft" onClick={() => setConfirmDelete(a.id)}>
                    <Trash />
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {adding ? (
        <Card tone="soft" className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-h3 text-ink">Nueva cuenta</h3>
            <button type="button" onClick={() => setAdding(false)} className="text-sm font-bold text-ink-2 hover:text-ink">
              Cancelar
            </button>
          </div>
          <AccountForm
            onSaved={() => {
              setAdding(false);
              reload();
            }}
          />
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus />
          Agregar cuenta
        </Button>
      )}
    </>
  );
}

function Documents() {
  const legal = useApi<LegalDoc[]>("/worker/legal");
  const docs = useApi<WorkerDocument[]>("/worker/documents");
  const [showAll, setShowAll] = useState(false);
  const receipts = (docs.data ?? []).filter((d) => d.type === "RECEIPT");

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-sm font-bold text-ink-2">Términos y autorizaciones</h3>
        {legal.loading && !legal.data ? (
          <LoadingRows count={3} />
        ) : legal.error ? (
          <ErrorState error={legal.error} onRetry={legal.reload} />
        ) : (
          <Card tone="soft" className="overflow-hidden">
            {(legal.data ?? []).map((d, i) => (
              <details key={d.id} className={cn("group px-4 [&_summary::-webkit-details-marker]:hidden", i > 0 && "border-t border-line-soft")}>
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-3">
                  <IconBox size="sm" tone={d.acceptedAt ? "green" : "amber"}>
                    <FileText />
                  </IconBox>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-ink">{d.title}</span>
                    <span className={cn("text-[13px] font-semibold", d.acceptedAt ? "text-ink-3" : "text-warning")}>
                      v{d.version} · {d.acceptedAt ? `Aceptado el ${stamp(d.acceptedAt)}` : "Pendiente de aceptar"}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-90" />
                </summary>
                <p className="pb-4 pl-12 text-sm leading-relaxed font-medium text-ink-2">{d.body}</p>
              </details>
            ))}
          </Card>
        )}
        {legal.data?.some((d) => !d.acceptedAt) && (
          <Link href="/app/onboarding" className="px-1 text-sm font-bold text-green-700 underline underline-offset-4">
            Aceptar documentos pendientes
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-sm font-bold text-ink-2">Comprobantes</h3>
        {docs.loading && !docs.data ? (
          <LoadingRows count={3} />
        ) : docs.error ? (
          <ErrorState error={docs.error} onRetry={docs.reload} />
        ) : receipts.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin comprobantes" text="Cada retiro o pago genera un comprobante que verás aquí." />
        ) : (
          <Card tone="soft" className="overflow-hidden">
            {(showAll ? receipts : receipts.slice(0, 6)).map((d, i) => (
              <Link
                key={d.id}
                href={`/app/comprobante/${d.title.split(" ").pop()}`}
                className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70"
              >
                <IconBox size="sm">
                  <Receipt />
                </IconBox>
                <span className={cn("flex min-h-[56px] flex-1 items-center gap-2 pr-4", i > 0 && "border-t border-line-soft")}>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-bold text-ink">{d.title}</span>
                    <span className="text-[13px] font-medium text-ink-3">{dateFmt(d.createdAt)}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </Card>
        )}
        {receipts.length > 6 && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            Ver los {receipts.length} comprobantes
          </Button>
        )}
      </section>
    </>
  );
}
