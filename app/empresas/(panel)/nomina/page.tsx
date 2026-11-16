"use client";

import { Suspense, useState } from "react";
import { CloudUpload } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { ErrorState, PageLoading, useCanWrite, useQueryState } from "@/components/flexa/empresas/kit";
import { IntegrationTab, NoveltiesTab, PayrollStatus, PayrollUploadDialog, PeriodsTab, UploadsTab } from "@/components/flexa/empresas/payroll";
import type { Period } from "@/components/flexa/empresas/types";
import { PillTabs } from "@/components/flexa/pill-tabs";
import { Button } from "@/components/flexa/ui";
import { useApi } from "@/lib/api";

const tabs = [
  { value: "estado", label: "Estado del periodo" },
  { value: "periodos", label: "Periodos" },
  { value: "cargas", label: "Cargas" },
  { value: "novedades", label: "Novedades" },
  { value: "integracion", label: "Integración" },
] as const;

function Payroll() {
  const canWrite = useCanWrite();
  const [tab, setTab] = useQueryState("tab", "estado");
  const [upload, setUpload] = useState(false);
  const periods = useApi<Period[]>("/payroll/periods");
  if (periods.loading && !periods.data) return <PageLoading />;
  if (periods.error || !periods.data) return <ErrorState error={periods.error} onRetry={periods.reload} />;
  return (
    <>
      <PageHeader
        title="Nómina"
        sub="Información de nómina que alimenta el cálculo del salario disponible."
        action={canWrite && <Button size="md" onClick={() => setUpload(true)}><CloudUpload />Cargar nómina</Button>}
      />
      <PillTabs variant="segmented" options={tabs} value={tab as (typeof tabs)[number]["value"]} onChange={setTab} />
      {tab === "estado" && <PayrollStatus onUpload={() => setUpload(true)} />}
      {tab === "periodos" && <PeriodsTab periods={periods.data} reload={periods.reload} />}
      {tab === "cargas" && <UploadsTab />}
      {tab === "novedades" && <NoveltiesTab periods={periods.data} />}
      {tab === "integracion" && <IntegrationTab />}
      <PayrollUploadDialog open={upload} onClose={() => setUpload(false)} periods={periods.data} />
    </>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Payroll />
    </Suspense>
  );
}
