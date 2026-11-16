"use client";

import Link from "next/link";
import { Banknote, Building2, HandCoins, IdCard, MessageCircle, TriangleAlert, Users, X } from "@/components/flexa/icons";
import { Async, PageHeader, statusLabel } from "@/components/flexa/admin/admin-ui";
import { CardHead, Kpi } from "@/components/flexa/empresas-ui";
import { Card, IconBox } from "@/components/flexa/ui";
import { money, useApi } from "@/lib/api";

type Overview = {
  companies: Record<string, number>;
  enabledWorkers: number;
  last30Days: { requests: number; disbursed: number; disbursedAmount: number; failed: number; successRatePct: number; byStatus: Record<string, number> };
  openIncidents: number;
  openTickets: number;
  kycPendingReview: number;
};

export default function AdminHome() {
  const state = useApi<Overview>("/admin/overview");
  return (
    <>
      <PageHeader title="Resumen de la operación" sub="Todas las empresas cliente, últimos 30 días." />
      <Async state={state}>
        {(o) => {
          const totalCompanies = Object.values(o.companies).reduce((a, b) => a + b, 0);
          const byStatus = Object.entries(o.last30Days.byStatus).sort((a, b) => b[1] - a[1]);
          const maxStatus = Math.max(1, ...byStatus.map(([, n]) => n));
          const queue = [
            { href: "/admin/incidencias", icon: TriangleAlert, label: "Incidencias abiertas o escaladas", n: o.openIncidents, tone: "red" as const },
            { href: "/admin/soporte", icon: MessageCircle, label: "Solicitudes de soporte sin cerrar", n: o.openTickets, tone: "amber" as const },
            { href: "/admin/kyc", icon: IdCard, label: "Validaciones KYC en revisión manual", n: o.kycPendingReview, tone: "teal" as const },
            { href: "/admin/operaciones?status=FAILED", icon: X, label: "Desembolsos fallidos (30 días)", n: o.last30Days.failed, tone: "red" as const },
          ];
          return (
            <>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <Kpi icon={Building2} value={totalCompanies} label="Empresas cliente" tone="green" trend={`${o.companies.ACTIVE ?? 0} activas`} />
                <Kpi icon={Users} value={o.enabledWorkers.toLocaleString("es-CO")} label="Trabajadores habilitados" tone="teal" />
                <Kpi icon={HandCoins} value={o.last30Days.requests} label="Solicitudes de anticipo" tone="amber" trend={`${o.last30Days.successRatePct}% éxito`} />
                <Kpi icon={Banknote} value={money(o.last30Days.disbursedAmount)} label={`Desembolsado en ${o.last30Days.disbursed} retiros`} tone="green" />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Card className="flex flex-col gap-4 p-6">
                  <CardHead title="Requiere atención" sub="Colas de trabajo del equipo FLEXA" />
                  <ul className="flex flex-col">
                    {queue.map((q) => (
                      <li key={q.href}>
                        <Link href={q.href} className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-mint-1">
                          <IconBox tone={q.n ? q.tone : "gray"} size="sm">
                            <q.icon />
                          </IconBox>
                          <span className="flex-1 text-[15px] font-semibold text-ink">{q.label}</span>
                          <span className="text-xl font-extrabold text-ink tabular-nums">{q.n}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="flex flex-col gap-4 p-6">
                  <CardHead title="Solicitudes por estado" sub="Últimos 30 días" />
                  {byStatus.length === 0 ? (
                    <p className="text-sm font-medium text-ink-2">Sin solicitudes en este periodo.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {byStatus.map(([s, n]) => (
                        <li key={s} className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-sm">
                          <span className="font-semibold text-ink-2">{statusLabel(s)}</span>
                          <span className="h-2.5 overflow-hidden rounded-full bg-mint-1">
                            <span className={`block h-full rounded-full ${s === "FAILED" || s === "REJECTED" ? "bg-danger" : "bg-green-500"}`} style={{ width: `${(n / maxStatus) * 100}%` }} />
                          </span>
                          <span className="text-right font-bold text-ink tabular-nums">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap gap-x-6 gap-y-1 border-t border-line-soft pt-4 text-[13px] font-semibold text-ink-2">
                    {Object.entries(o.companies).map(([s, n]) => (
                      <span key={s}>
                        Empresas {statusLabel(s).toLowerCase()}: <b className="text-ink">{n}</b>
                      </span>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
