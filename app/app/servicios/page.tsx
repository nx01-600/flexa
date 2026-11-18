"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bus, Droplets, Flame, Smartphone, Sparkles, Wifi, X, Zap, type IconType } from "@/components/flexa/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { Choice } from "@/components/flexa/choice";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { ErrorState, Notice, Skeleton } from "@/components/flexa/worker/states";
import type { Earnings } from "@/components/flexa/worker/types";
import { Button, Card, Field, IconBox, Input } from "@/components/flexa/ui";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError, money, useApi } from "@/lib/api";

type Service = { icon: IconType; label: string; category: string; kind: "PAGO" | "RECARGA"; billers: string[]; refLabel: string; tint: string };

// Each category gets its own soft tint so the grid reads at a glance.
const services: Service[] = [
  { icon: Zap, label: "Energía", category: "Energía", kind: "PAGO", billers: ["EPM", "Emcali", "Celsia", "Enel", "Air-e"], refLabel: "Número de contrato", tint: "bg-[#fff1cc] text-[#946200]" },
  { icon: Droplets, label: "Agua", category: "Agua", kind: "PAGO", billers: ["EPM Aguas", "Emcali Acueducto", "Acueducto de Bogotá"], refLabel: "Número de contrato", tint: "bg-[#e1eefb] text-[#2a5d97]" },
  { icon: Flame, label: "Gas natural", category: "Gas", kind: "PAGO", billers: ["Gases de Occidente", "Vanti", "EPM Gas"], refLabel: "Número de contrato", tint: "bg-[#fde6dc] text-[#b04a1f]" },
  { icon: Wifi, label: "Internet y TV", category: "Internet", kind: "PAGO", billers: ["Claro hogar", "Movistar hogar", "Tigo hogar", "ETB"], refLabel: "Referencia de pago", tint: "bg-teal-soft text-teal" },
  { icon: Smartphone, label: "Recargas", category: "Telefonía", kind: "RECARGA", billers: ["Claro", "Movistar", "Tigo", "WOM"], refLabel: "Número de celular", tint: "bg-[#e2f2de] text-green-600" },
  { icon: Bus, label: "Transporte", category: "Transporte", kind: "RECARGA", billers: ["MIO", "TransMilenio", "Metro de Medellín"], refLabel: "Número de tarjeta", tint: "bg-[#ece6f7] text-[#5a3f94]" },
];

const quick = [20_000, 50_000, 100_000];

export default function Services() {
  const router = useRouter();
  const earnings = useApi<Earnings>("/worker/earnings");
  const [open, setOpen] = useState<Service | null>(null);
  const [biller, setBiller] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = earnings.data;
  const over = !!e && amount > e.available;
  const valid = !!open && !!biller && reference.replace(/\D/g, "").length >= 4 && amount >= 1_000 && !over;

  const start = (s: Service) => {
    setOpen(s);
    setBiller(null);
    setReference("");
    setAmount(0);
    setError(null);
  };

  const pay = async () => {
    if (!open || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api<{ code: string }>("/worker/payments", { body: { kind: open.kind, category: open.category, biller, reference: reference.trim(), amount } });
      router.push(`/app/comprobante/${p.code}?nuevo=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos hacer el pago.");
      setBusy(false);
    }
  };

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Pagos y recargas" />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-10">
        <Card tone="mint" className="relative isolate flex flex-col gap-3 overflow-hidden p-5">
          <Blob shape={2} tone="deep" className="-right-14 -bottom-16 -z-10 size-48 opacity-80" />
          <IconBox tone="solid" size="lg">
            <Sparkles />
          </IconBox>
          <div className="flex flex-col gap-1">
            <h2 className="text-h2 text-ink">Paga tus servicios con lo que ya ganaste</h2>
            <p className="max-w-[32ch] text-sm font-medium text-green-900 md:max-w-none">
              Se descuenta de tu disponible y de tu próximo pago de nómina, igual que un retiro.
            </p>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-sm font-semibold text-green-900">Disponible</span>
            {e ? <span className="text-xl font-extrabold text-ink tabular-nums">{money(e.available)}</span> : earnings.error ? <span className="text-sm font-semibold text-danger">No disponible</span> : <Skeleton className="h-6 w-24" />}
          </div>
        </Card>

        {earnings.error && <ErrorState error={earnings.error} onRetry={earnings.reload} title="No pudimos consultar tu disponible" />}

        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">¿Qué quieres pagar?</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {services.map((s) => (
              <li key={s.label}>
                <button type="button" onClick={() => start(s)} className="h-full w-full text-left transition-transform duration-150 active:scale-[0.98]">
                  <Card tone="soft" className="flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-md">
                    <IconBox className={s.tint}>
                      <s.icon />
                    </IconBox>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-bold text-ink">{s.label}</span>
                      <span className="text-[13px] font-medium text-ink-2">{s.billers.slice(0, 3).join(", ")}</span>
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Sheet open={!!open} onOpenChange={(o) => !o && !busy && setOpen(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-h-[92dvh] max-w-[430px] gap-0 overflow-y-auto rounded-t-2xl border-0 bg-page p-0 md:data-[side=bottom]:bottom-6 md:max-h-[calc(100dvh-3rem)] md:max-w-[520px] md:rounded-2xl">
          {open && (
            <div className="flex flex-col gap-4 px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3">
                <IconBox className={open.tint}>
                  <open.icon />
                </IconBox>
                <div className="flex flex-1 flex-col">
                  <SheetTitle className="text-h3 font-bold text-ink">{open.kind === "RECARGA" ? `Recarga · ${open.label}` : `Pagar ${open.label.toLowerCase()}`}</SheetTitle>
                  <SheetDescription className="text-[13px] font-medium text-ink-2">
                    Disponible {e ? money(e.available) : "—"}
                  </SheetDescription>
                </div>
                <SheetClose aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-black/[0.03]">
                  <X weight="bold" className="size-5" />
                </SheetClose>
              </div>
              <Field label="Empresa" htmlFor="sv-biller">
                <Choice id="sv-biller" options={open.billers} value={biller} onChange={setBiller} placeholder="Selecciona" className="data-[size=default]:h-13" />
              </Field>
              <Field label={open.refLabel} htmlFor="sv-ref">
                <Input id="sv-ref" inputMode="numeric" autoComplete="off" value={reference} onChange={(ev) => setReference(ev.target.value.replace(/[^\d ]/g, "").slice(0, 20))} />
              </Field>
              <Field label="Valor" htmlFor="sv-amount" hint={over ? undefined : "Sin costo adicional."}>
                <Input
                  id="sv-amount"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="$0"
                  aria-invalid={over}
                  value={amount ? money(amount) : ""}
                  onChange={(ev) => setAmount(Number(ev.target.value.replace(/\D/g, "").slice(0, 8)) || 0)}
                />
              </Field>
              {open.kind === "RECARGA" && (
                <div className="grid grid-cols-3 gap-2">
                  {quick.map((q) => (
                    <Button key={q} size="sm" variant={amount === q ? "primary" : "outline"} onClick={() => setAmount(q)}>
                      {money(q)}
                    </Button>
                  ))}
                </div>
              )}
              {over && <Notice tone="error">El valor supera tu disponible de {money(e!.available)}.</Notice>}
              {error && <Notice tone="error">{error}</Notice>}
              <Button onClick={pay} disabled={!valid || busy}>
                {busy ? "Pagando..." : amount ? `Pagar ${money(amount)}` : "Pagar"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
