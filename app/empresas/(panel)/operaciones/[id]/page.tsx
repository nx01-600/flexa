"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Check, RotateCw, X } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { AdvanceBadge, advanceStatus, ConfirmDialog, dateTime, EmptyState, ErrorState, Facts, Notice, PageLoading, ReadOnlyHint, SectionCard, useCanWrite } from "@/components/flexa/empresas/kit";
import type { Advance, AuditEntry } from "@/components/flexa/empresas/types";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Badge, Button } from "@/components/flexa/ui";
import { api, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Detail = Advance & {
  events: { id: string; status: string; note: string | null; actor: string | null; createdAt: string }[];
  audit: AuditEntry[];
};

const accountType: Record<string, string> = { SAVINGS: "Ahorros", CHECKING: "Corriente", WALLET: "Billetera" };

export default function AdvanceDetail() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCanWrite();
  const { data: a, error, loading, reload } = useApi<Detail>(`/company/advances/${id}`);
  const [decision, setDecision] = useState<"approve" | "reject" | "retry" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading && !a) return <PageLoading />;
  if (error || !a) return <ErrorState error={error} onRetry={reload} />;
  const name = `${a.worker?.firstName} ${a.worker?.lastName}`;

  return (
    <>
      <PageHeader
        back={{ href: "/empresas/operaciones", label: "Operaciones" }}
        title={`Solicitud ${a.code}`}
        sub={`${name} · ${a.worker?.docNumber} · ${dateTime(a.createdAt)}`}
        action={<AdvanceBadge value={a.status} className="h-9 px-4 text-sm" />}
      />
      {msg && <Notice onClose={() => setMsg(null)}>{msg}</Notice>}

      {(a.status === "EXCEPTION" || a.status === "FAILED") && (
        <SectionCard className={a.status === "FAILED" ? "bg-tint-red" : "bg-tint-amber"}>
          <CardHead
            title={a.status === "EXCEPTION" ? "Requiere tu decisión" : "El desembolso falló"}
            sub={a.status === "EXCEPTION" ? (a.exceptionReason ?? "La solicitud superó una regla de revisión.") : "Puedes reintentar cuando el trabajador corrija su cuenta o el proveedor se recupere."}
          />
          {canWrite ? (
            <div className="flex gap-3 max-lg:flex-wrap">
              {a.status === "EXCEPTION" ? (
                <>
                  <Button size="md" onClick={() => setDecision("approve")}><Check />Aprobar y desembolsar</Button>
                  <Button variant="danger-outline" size="md" onClick={() => setDecision("reject")}><X />Rechazar</Button>
                </>
              ) : (
                <Button size="md" onClick={() => setDecision("retry")}><RotateCw />Reintentar desembolso</Button>
              )}
            </div>
          ) : (
            <ReadOnlyHint />
          )}
        </SectionCard>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard>
          <CardHead title="Detalle" action={<Link href={`/empresas/trabajadores/${a.workerId}`} className="text-[13px] font-bold text-green-700 hover:underline">Ver trabajador</Link>} />
          <Facts
            items={[
              ["Monto solicitado", money(a.amount)],
              ["Comisión", money(a.fee)],
              ["Recibe el trabajador", money(a.netAmount)],
              ["Periodo", `${a.period?.label ?? "—"}`],
              ["Disponible al solicitar", money(a.availableAtRequest)],
              ["Recomendado al solicitar", money(a.recommendedAtRequest)],
              ["Cuenta de destino", a.bankAccount ? `${a.bankAccount.bank} · ${accountType[a.bankAccount.type ?? ""] ?? ""} ${a.bankAccount.number ?? ""}` : "—"],
              ["Desembolsado", dateTime(a.disbursedAt)],
              ["Referencia de pago", a.providerRef ?? "—"],
              ["Referencia de fondeo", a.fundingRef ?? "—"],
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {a.overRecommended && <Badge tone="amber">Sobre el recomendado</Badge>}
            {a.warningAcknowledged && <Badge tone="teal">Advertencias aceptadas por el trabajador</Badge>}
          </div>
        </SectionCard>

        <SectionCard>
          <CardHead title="Línea de tiempo" />
          <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-green-100">
            {a.events.map((e, i) => {
              const tone = advanceStatus[e.status]?.[1];
              return (
                <li key={e.id} className="relative flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "absolute top-1 -left-6 size-4 rounded-full ring-4 ring-white",
                      tone === "red" ? "bg-danger-500" : tone === "amber" ? "bg-warning-icon" : i === a.events.length - 1 ? "bg-green-600" : "bg-green-300",
                    )}
                  />
                  <span className="text-[15px] font-bold text-ink">{advanceStatus[e.status]?.[0] ?? e.status}</span>
                  <span className="text-[13px] font-medium text-ink-2">{dateTime(e.createdAt)}{e.actor ? "" : " · automático"}</span>
                  {e.note && <span className="text-[13px] font-medium text-ink">{e.note}</span>}
                </li>
              );
            })}
          </ol>
        </SectionCard>
      </div>

      <SectionCard>
        <CardHead title="Trazabilidad" sub="Acciones registradas sobre esta solicitud" />
        {a.audit.length ? (
          <ul className="flex flex-col divide-y divide-line-soft">
            {a.audit.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 py-2.5 text-sm max-lg:flex-wrap max-lg:gap-y-1">
                <span className="font-bold text-ink max-lg:break-all">{l.action}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-3 max-lg:order-last max-lg:basis-full">{l.data ? JSON.stringify(l.data) : ""}</span>
                <span className="text-ink-2">{dateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin registros adicionales" text="Los cambios de estado aparecen en la línea de tiempo." className="py-4" />
        )}
      </SectionCard>

      <ConfirmDialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision === "approve" ? "Aprobar solicitud" : decision === "reject" ? "Rechazar solicitud" : "Reintentar desembolso"}
        text={
          decision === "approve"
            ? `Se desembolsarán ${money(a.netAmount)} a ${name} y se descontarán en la nómina de ${a.period?.label}.`
            : decision === "reject"
              ? `${name} recibirá una notificación con tu nota.`
              : `Volveremos a enviar ${money(a.netAmount)} a la cuenta registrada.`
        }
        confirm={decision === "approve" ? "Aprobar" : decision === "reject" ? "Rechazar" : "Reintentar"}
        danger={decision === "reject"}
        note={decision === "retry" ? undefined : { label: "Nota de la decisión", placeholder: "Queda en la trazabilidad de la solicitud", min: 3 }}
        onConfirm={async (note) => {
          await api(`/company/advances/${a.id}/${decision}`, { body: decision === "retry" ? {} : { note } });
          setMsg(decision === "approve" ? "Solicitud aprobada." : decision === "reject" ? "Solicitud rechazada." : "Reintento enviado.");
          reload();
        }}
      />
    </>
  );
}
