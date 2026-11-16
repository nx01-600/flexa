"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BellRinging, CalendarClock, CircleDollarSign, HeartPulse, Lightbulb, PiggyBank, TriangleAlert } from "@/components/flexa/worker/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { Bars, Donut } from "@/components/flexa/charts";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { EmptyState, ErrorState, LoadingCards, LoadingRows } from "@/components/flexa/worker/states";
import { stamp, type Alert, type Wellness } from "@/components/flexa/worker/types";
import { Badge, Button, Card, IconBox, StatTile } from "@/components/flexa/ui";
import { api, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type View = "resumen" | "alarma";

// Módulo 4: financial wellness and the Alarma FLEXA.
export function FinancesScreen() {
  const router = useRouter();
  const path = usePathname();
  const view: View = useSearchParams().get("vista") === "alarma" ? "alarma" : "resumen";
  const alerts = useApi<Alert[]>("/worker/alerts");
  const unread = alerts.data?.filter((a) => !a.read).length ?? 0;
  const views = [
    { value: "resumen" as const, label: "Mi bienestar" },
    { value: "alarma" as const, label: unread ? `Alarma FLEXA (${unread})` : "Alarma FLEXA" },
  ];

  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Mis finanzas" />
      <main className="flex flex-col gap-4 px-5 pt-2">
        <PillTabs variant="segmented" options={views} value={view} onChange={(v) => router.replace(v === "resumen" ? path : `${path}?vista=${v}`, { scroll: false })} />
        {view === "resumen" ? <Summary /> : <Alarm state={alerts} />}
      </main>
    </>
  );
}

function Summary() {
  const { data: w, error, loading, reload } = useApi<Wellness>("/worker/wellness");
  if (!w) return loading ? <LoadingCards count={3} label="Cargando tu bienestar financiero" /> : <ErrorState error={error} onRetry={reload} />;

  const ratio = w.recommended + w.used > 0 ? Math.round((w.used / (w.used + w.recommended)) * 100) : 0;
  const near = w.usagePct >= w.alarmThresholds.usagePct;
  const periods = w.byPeriod.map((p) => ({ period: p.period.replace(/ \d{4}$/, ""), value: p.total }));

  return (
    <>
      <Card tone={w.overRecommended ? "amber" : "mint"} className="relative isolate flex items-center gap-5 overflow-hidden p-5">
        <Blob shape={1} tone="deep" className="-top-10 -right-12 -z-10 size-40 opacity-60" />
        <Donut size={116} thickness={18} data={[{ name: "Usado", value: w.used }, { name: "Recomendado restante", value: Math.max(w.recommended, 0.0001) }]}>
          <span className="flex flex-col items-center">
            <span className="text-xl leading-none font-extrabold text-ink tabular-nums">{w.usagePct}%</span>
            <span className="mt-1 text-[11px] font-semibold text-ink-3">de tu tope</span>
          </span>
        </Donut>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
            <HeartPulse className="size-4" weight="fill" />
            Recomendado vs. usado
          </span>
          <span className="text-h2 text-ink">{w.overRecommended ? "Por encima" : near ? "Con cuidado" : "Vas bien"}</span>
          <span className="text-[13px] font-medium text-ink-2">
            Usaste {money(w.used)}. {w.recommended > 0 ? `Aún puedes usar ${money(w.recommended)} dentro de lo recomendado.` : "Ya alcanzaste lo recomendado este periodo."}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={PiggyBank} tone="green" label="Recomendado" value={money(w.recommended)} hint={`${ratio}% ya usado`} />
        <StatTile icon={CircleDollarSign} tone="teal" label="Disponible" value={money(w.available)} />
      </div>

      <Card tone="soft" className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 text-ink">Tu próximo pago</h2>
            <span className="text-sm font-medium text-ink-2">Estimado después de tus retiros</span>
          </div>
          <IconBox tone="teal" size="sm">
            <CalendarClock />
          </IconBox>
        </div>
        <span className="text-display text-ink tabular-nums">{money(w.nextPayAfterUsage)}</span>
        <div className="flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-green-100" role="img" aria-label={`Recibirás ${money(w.nextPayAfterUsage)} de ${money(w.projectedNet)}`}>
            <span className="block h-full rounded-full bg-linear-to-r from-green-400 to-green-600" style={{ width: `${w.projectedNet ? (w.nextPayAfterUsage / w.projectedNet) * 100 : 0}%` }} />
          </div>
          <span className="text-[13px] font-semibold text-ink-3">
            De un neto proyectado de {money(w.projectedNet)} se descuentan {money(w.used)}.
          </span>
        </div>
      </Card>

      <Card tone="soft" className="flex flex-col gap-3 p-5">
        <h2 className="text-h3 text-ink">Uso por periodo</h2>
        {periods.length ? <Bars data={periods} x="period" height={180} highlightLast /> : <p className="text-sm font-medium text-ink-2">Aún no hay periodos con retiros.</p>}
        <p className="text-xs font-semibold text-ink-3">Incluye retiros, pagos de servicios y recargas.</p>
      </Card>

      {w.tips.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">Consejos para ti</h2>
          {w.tips.map((t) => (
            <Card key={t} tone="soft" className="flex items-start gap-3 p-4">
              <IconBox tone="amber" size="sm">
                <Lightbulb />
              </IconBox>
              <p className="pt-1.5 text-sm font-medium text-ink">{t}</p>
            </Card>
          ))}
        </section>
      )}
      <p className="px-1 pb-2 text-[13px] font-medium text-ink-3">
        La Alarma FLEXA te avisa al pasar el {w.alarmThresholds.usagePct}% de tu tope o al llegar a {w.alarmThresholds.requests} retiros en el periodo. Nunca bloquea tus retiros.
      </p>
    </>
  );
}

const levelTone = { INFO: "green", WARNING: "amber", CRITICAL: "red" } as const;

function Alarm({ state }: { state: ReturnType<typeof useApi<Alert[]>> }) {
  const { data, error, loading, reload, setData } = state;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const markRead = async (a: Alert) => {
    if (a.read) return;
    setData((list) => list?.map((x) => (x.id === a.id ? { ...x, read: true } : x)) ?? null);
    try {
      await api(`/worker/alerts/${a.id}/read`, { method: "PATCH" });
    } catch {
      reload();
    }
  };

  const readAll = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await api("/worker/alerts/read-all", { method: "POST" });
      setData((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <LoadingRows count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState icon={BellRinging} title="Sin alertas" text="Te avisaremos aquí cuando un retiro se desembolse o tu uso se acerque al tope." />;

  const unread = data.some((a) => !a.read);
  return (
    <>
      {unread && (
        <div className="flex items-center justify-between gap-3">
          <span className={cn("text-sm font-semibold", failed ? "text-danger" : "text-ink-2")}>{failed ? "No pudimos actualizar. Intenta de nuevo." : "Toca una alerta para marcarla como leída."}</span>
          <Button variant="ghost" size="sm" onClick={readAll} disabled={busy}>
            Marcar todas
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {data.map((a) => {
          const tone = levelTone[a.level as keyof typeof levelTone] ?? "green";
          return (
            <li key={a.id}>
              <button type="button" onClick={() => markRead(a)} className="w-full text-left" aria-label={`${a.title}${a.read ? "" : ", sin leer"}`}>
                <Card tone={a.read ? "white" : "soft"} className={cn("flex items-start gap-3 p-4 transition-opacity", a.read && "opacity-75 shadow-sm")}>
                  <IconBox tone={tone} size="sm">
                    {tone === "green" ? <BellRinging /> : <TriangleAlert />}
                  </IconBox>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink">{a.title}</span>
                      {!a.read && <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden />}
                    </span>
                    <span className="text-sm font-medium text-ink-2">{a.message}</span>
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-3">
                      {stamp(a.createdAt)}
                      {tone !== "green" && (
                        <Badge tone={tone} className="h-5 px-2 text-[11px]">
                          {tone === "red" ? "Importante" : "Atención"}
                        </Badge>
                      )}
                    </span>
                  </span>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
