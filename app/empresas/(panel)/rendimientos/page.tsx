"use client";

import { useState } from "react";
import { Banknote, CalendarDays, HandCoins, MapPin, Users } from "@/components/flexa/icons";
import { Bars, TrendArea } from "@/components/flexa/charts";
import { PageHeader } from "@/components/flexa/company-shell";
import { ShareList } from "@/components/flexa/empresas/charts";
import { ErrorState, PageLoading, SectionCard } from "@/components/flexa/empresas/kit";
import { CardHead, Kpi } from "@/components/flexa/empresas-ui";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { money, useApi } from "@/lib/api";

type Usage = {
  period: { label: string } | null;
  weekly: { week: string; value: number }[];
  monthly: { month: string; value: number }[];
  weekday: { day: string; value: number }[];
  bySite: { name: string; value: number; pct: number }[];
  categories: { name: string; value: number; pct: number }[];
  totals: { withdrawn: number; withdrawals: number; users: number };
};

const ranges = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Último año" },
] as const;

export default function Returns() {
  const [months, setMonths] = useState<(typeof ranges)[number]["value"]>("6");
  const { data: u, error, loading, reload } = useApi<Usage>(`/analytics/usage?months=${months}`);
  const peak = u?.weekday.reduce((a, b) => (b.value > a.value ? b : a), u.weekday[0]);
  return (
    <>
      <PageHeader title="Rendimientos" sub="Cómo usan Flexa tus trabajadores: montos, días, categorías y sedes." action={<PillTabs options={ranges} value={months} onChange={setMonths} />} />
      {loading && !u ? (
        <PageLoading />
      ) : error || !u ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi icon={Banknote} value={money(u.totals.withdrawn)} label="Retirado en el rango" />
            <Kpi icon={HandCoins} value={u.totals.withdrawals} label="Retiros" tone="teal" />
            <Kpi icon={Users} value={u.totals.users} label="Trabajadores que usaron Flexa" tone="green" />
            <Kpi icon={CalendarDays} value={peak?.day ?? "—"} label="Día con más retiros" tone="amber" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <SectionCard>
              <CardHead title="Retirado por mes" sub={ranges.find((r) => r.value === months)?.label} />
              <TrendArea data={u.monthly} x="month" height={260} />
            </SectionCard>
            <SectionCard>
              <CardHead title="Por día de la semana" />
              <Bars data={u.weekday} x="day" height={260} highlightLast={false} />
            </SectionCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard>
              <CardHead title="Categorías" sub="Retiros a cuenta y pagos de servicios" />
              <ShareList items={u.categories} />
            </SectionCard>
            <SectionCard>
              <CardHead title="Por sede" action={<MapPin className="size-5 text-green-700" />} />
              <ShareList items={u.bySite} />
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
