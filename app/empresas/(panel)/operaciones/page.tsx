"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { PageLoading, useQueryState } from "@/components/flexa/empresas/kit";
import { AdvancesTab, IncidentsTab, RulesTab } from "@/components/flexa/empresas/operations";
import { PillTabs } from "@/components/flexa/pill-tabs";

const tabs = [
  { value: "solicitudes", label: "Solicitudes" },
  { value: "incidencias", label: "Incidencias" },
  { value: "reglas", label: "Reglas aplicadas" },
] as const;

function Operations() {
  const [tab, setTab] = useQueryState("tab", "solicitudes");
  const [status, setStatus] = useQueryState("status");
  const [periodId, setPeriodId] = useQueryState("periodId");
  const [from, setFrom] = useQueryState("from");
  const [to, setTo] = useQueryState("to");
  const [workerId, setWorkerId] = useQueryState("workerId");
  const setters = { status: setStatus, periodId: setPeriodId, from: setFrom, to: setTo, workerId: setWorkerId };
  return (
    <>
      <PageHeader title="Operaciones" sub="Solicitudes de anticipo, excepciones e incidencias de la operación." />
      <PillTabs variant="segmented" options={tabs} value={tab as (typeof tabs)[number]["value"]} onChange={setTab} />
      {tab === "solicitudes" && <AdvancesTab filters={{ status, periodId, from, to, workerId }} setFilter={(k, v) => setters[k](v)} />}
      {tab === "incidencias" && <IncidentsTab />}
      {tab === "reglas" && <RulesTab />}
    </>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Operations />
    </Suspense>
  );
}
