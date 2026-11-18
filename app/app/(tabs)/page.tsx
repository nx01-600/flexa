"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowUpRight, Bell, ChevronRight, LayoutGrid, Lightbulb, Receipt } from "@/components/flexa/icons";
import { MenuButton } from "@/components/flexa/app-shell";
import { Bars } from "@/components/flexa/charts";
import { Logo } from "@/components/flexa/logo";
import { MovementRow } from "@/components/flexa/movement-row";
import { Backdrop } from "@/components/flexa/shapes";
import { Avatar } from "@/components/flexa/worker/avatar";
import { EmptyState, ErrorState, LoadingRows, Notice, Skeleton } from "@/components/flexa/worker/states";
import type { Alert, Earnings, Movement, Profile, Wellness } from "@/components/flexa/worker/types";
import { Card, IconBox, SectionTitle } from "@/components/flexa/ui";
import { dateFmt, money, timeFmt, useApi } from "@/lib/api";
import { useSessionName } from "@/components/flexa/worker/guard";

export default function WorkerHome() {
  const router = useRouter();
  const profile = useApi<Profile>("/worker/profile");
  const earnings = useApi<Earnings>("/worker/earnings");
  const weekly = useApi<{ week: string; value: number }[]>("/worker/earnings/weekly");
  const movements = useApi<Movement[]>("/worker/movements");
  const unread = useApi<Alert[]>("/worker/alerts?unread=true");
  const wellness = useApi<Wellness>("/worker/wellness");

  const incomplete = profile.data && !profile.data.onboarding.complete;
  useEffect(() => {
    if (incomplete) router.replace("/app/onboarding");
  }, [incomplete, router]);

  const sessionName = useSessionName();
  const name = profile.data ? `${profile.data.firstName} ${profile.data.lastName}` : sessionName;
  const firstName = name.split(" ")[0];
  const e = earnings.data;
  const tips = wellness.data?.tips ?? [];
  const tip = tips.length ? tips[new Date().getDate() % tips.length] : null;
  const alerts = unread.data?.length ?? 0;

  return (
    // lg: two columns (balance + actions | chart + tip). The `contents` wrappers vanish below lg, so the base flow is untouched.
    <main className="flex flex-col gap-5 px-5 pt-3 lg:grid lg:grid-cols-2 lg:gap-x-4">
      <Backdrop variant="home" />
      <header className="grid h-14 grid-cols-[88px_1fr_88px] items-center lg:col-span-2">
        {/* Wrapper keeps the grid cell when the button hides from md up. */}
        <div>
          <MenuButton />
        </div>
        <Logo className="h-7 justify-self-center md:invisible" />
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/app/finanzas?vista=alarma"
            aria-label={alerts ? `Alarma FLEXA, ${alerts} sin leer` : "Alarma FLEXA"}
            className="relative grid size-10 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-black/[0.03] transition-transform active:scale-95"
          >
            <Bell weight="bold" className="size-5" />
            {alerts > 0 && (
              <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white tabular-nums ring-2 ring-page">
                {alerts > 9 ? "9+" : alerts}
              </span>
            )}
          </Link>
          <Link href="/app/perfil" aria-label="Mi perfil" className="size-10 overflow-hidden rounded-full shadow-sm ring-[3px] ring-white transition-transform active:scale-95">
            <Avatar name={name} size={40} priority className="size-full" />
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-1 pt-1 lg:col-span-2">
        <h1 className="text-h1 text-ink">{firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}</h1>
        <p className="max-w-[28ch] text-[15px] font-medium text-balance text-ink-2 md:max-w-none">
          {e?.period ? `Periodo ${e.period.label} · tu pago llega el ${dateFmt(e.period.payDate, { day: "numeric", month: "long" })}.` : "Tu bienestar financiero está en tus manos."}
        </p>
      </section>

      <div className="contents lg:flex lg:flex-col lg:gap-5">
        {earnings.error ? (
          <ErrorState error={earnings.error} onRetry={earnings.reload} title="No pudimos calcular tu saldo" />
        ) : (
          <Card aria-label="Saldo" className="overflow-hidden">
            <Link href="/app/salario" className="group flex flex-col gap-4 bg-card-hero px-5 pt-5 pb-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-white/80">Devengado neto a hoy</span>
                  {e ? <span className="text-display text-white tabular-nums">{money(e.netEarned)}</span> : <Skeleton className="h-9 w-44 bg-white/25" />}
                </div>
                <span className="mt-1 flex items-center gap-0.5 text-xs font-bold text-white/85 transition-transform group-hover:translate-x-0.5">
                  Detalle <ChevronRight className="size-3.5" />
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-2 overflow-hidden rounded-full bg-white/20" role="img" aria-label={`Has usado el ${e?.usagePct ?? 0}% de tu tope del periodo`}>
                  <span className="block h-full rounded-full bg-linear-to-r from-[#c8f0c0] to-white transition-[width] duration-500" style={{ width: `${Math.min(e?.usagePct ?? 0, 100)}%` }} />
                </div>
                <span className="text-[13px] font-semibold text-white/85">
                  {e ? `Usado ${money(e.used)} · ${e.usagePct}% de tu tope de ${money(e.limits.limitAmount)}` : "Calculando..."}
                </span>
              </div>
            </Link>
            <Link href="/app/retirar" className="group flex items-center justify-between gap-3 bg-surface px-5 py-4 transition-colors hover:bg-green-50/60">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-2">Disponible para retirar</span>
                {e ? <span className="text-money text-green-600 tabular-nums">{money(e.available)}</span> : <Skeleton className="h-8 w-32" />}
                {e && <span className="text-[13px] font-semibold text-ink-3">Recomendado: {money(e.recommended)}</span>}
              </span>
              <IconBox tone="white" className="transition-transform duration-200 group-hover:translate-x-0.5">
                <ChevronRight className="stroke-[2.5]" />
              </IconBox>
            </Link>
          </Card>
        )}

        {e && e.blockers.length > 0 && (
          <Notice tone="warning" title="Por ahora no puedes retirar">
            {e.blockers.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </Notice>
        )}

        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/app/retirar"
            className="flex h-[118px] flex-col justify-between rounded-lg bg-tile-primary p-4 shadow-tile ring-1 ring-inset ring-white/40 transition-transform duration-150 active:scale-[0.98]"
          >
            <IconBox tone="dark" className="shadow-[0_6px_14px_-6px_rgb(20_61_34/0.6)]">
              <ArrowUpRight className="stroke-[2.5]" />
            </IconBox>
            <span className="text-base font-bold text-green-900">Retirar</span>
          </Link>
          <Link href="/app/servicios" className="transition-transform duration-150 active:scale-[0.98]">
            <Card tone="soft" className="flex h-[118px] flex-col items-center justify-center gap-2 p-4 text-center">
              <IconBox>
                <LayoutGrid />
              </IconBox>
              <span className="text-[15px] leading-tight font-bold text-ink">
                Pagos y
                <br />
                recargas
              </span>
            </Card>
          </Link>
        </section>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-5">
        {weekly.data && weekly.data.length > 0 && (
          <Card tone="soft" className="flex flex-col gap-3 p-5">
            <SectionTitle
              action={
                <Link href="/app/salario" className="text-sm font-bold text-green-700 underline-offset-4 hover:underline lg:whitespace-nowrap">
                  Cómo se calcula
                </Link>
              }
            >
              Así crece tu devengado
            </SectionTitle>
            <Bars data={weekly.data} x="week" height={160} highlightLast />
            {e && (
              <p className="text-xs font-semibold text-ink-3">
                Datos de nómina actualizados el {dateFmt(e.dataUpdatedAt, { day: "numeric", month: "short" })} a las {timeFmt(e.dataUpdatedAt)}
              </p>
            )}
          </Card>
        )}

        {tip && (
          <Link href="/app/finanzas" className="group">
            <Card tone="soft" className="flex items-center gap-3 p-4">
              <IconBox tone="amber">
                <Lightbulb />
              </IconBox>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold text-ink">Consejo del día</span>
                <span className="text-sm font-medium text-ink-2">{tip}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Card>
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-3 pt-1 lg:col-span-2">
        <SectionTitle
          action={
            <Link href="/app/movimientos" className="text-sm font-bold text-green-700 underline-offset-4 hover:underline">
              Ver todos
            </Link>
          }
        >
          Últimos movimientos
        </SectionTitle>
        {movements.loading && !movements.data ? (
          <LoadingRows count={3} />
        ) : movements.error ? (
          <ErrorState error={movements.error} onRetry={movements.reload} />
        ) : movements.data?.length ? (
          <Card tone="soft" className="overflow-hidden">
            {movements.data.slice(0, 3).map((m, i) => (
              <MovementRow key={m.id} m={m} divider={i > 0} />
            ))}
          </Card>
        ) : (
          <EmptyState icon={Receipt} title="Aún no tienes movimientos" text="Cuando retires o pagues un servicio, lo verás aquí." />
        )}
      </section>
    </main>
  );
}
