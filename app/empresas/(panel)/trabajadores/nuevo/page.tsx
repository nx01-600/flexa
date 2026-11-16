"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/flexa/company-shell";
import { ReadOnlyHint, useCanWrite } from "@/components/flexa/empresas/kit";
import { WorkerForm } from "@/components/flexa/empresas/worker-forms";
import { Card } from "@/components/flexa/ui";

export default function NewWorker() {
  const router = useRouter();
  const canWrite = useCanWrite();
  return (
    <>
      <PageHeader
        back={{ href: "/empresas/trabajadores", label: "Trabajadores" }}
        title="Registrar trabajador"
        sub="Queda habilitado en Flexa y podrá crear su cuenta con su número de documento."
      />
      <Card className="max-w-3xl p-6">
        {canWrite ? <WorkerForm onSaved={(w) => router.push(`/empresas/trabajadores/${w.id}`)} onCancel={() => router.back()} /> : <ReadOnlyHint />}
      </Card>
    </>
  );
}
