"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Info, PencilIcon, ShieldCheck, UserCheck, UserX } from "@/components/flexa/empresas/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { AdvanceBadge, ConfirmDialog, Dialog, EmptyState, ErrorState, Facts, IncidentBadge, KycBadge, noveltyTypes, Notice, PageLoading, pct, SectionCard, useCanWrite, WorkerBadge } from "@/components/flexa/empresas/kit";
import type { Advance, Incident, Novelty, Worker } from "@/components/flexa/empresas/types";
import { WorkerForm } from "@/components/flexa/empresas/worker-forms";
import { Avatar, CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card } from "@/components/flexa/ui";
import { api, dateFmt, money, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Detail = Worker & {
  site: { id: string; name: string; city: string } | null;
  kycChecks: { id: string; type: string; status: string; score: number | null; createdAt: string }[];
  consents: { id: string; acceptedAt: string; document: { type: string; version: string; title: string } }[];
  accounts: { bank: string; type: string; isDefault: boolean }[];
  novelties: Omit<Novelty, "worker" | "period">[];
  incidents: Incident[];
  advances: Advance[];
  ewa: { netEarned: number; available: number; recommended: number; used: number; usagePct: number; blockers: string[] } | null;
};

const kycType: Record<string, string> = { DOCUMENT: "Documento de identidad", SELFIE_BIOMETRIC: "Biometría (selfie)", ANTIFRAUD: "Listas y antifraude" };
const accountType: Record<string, string> = { SAVINGS: "Ahorros", CHECKING: "Corriente", WALLET: "Billetera" };

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCanWrite();
  const { data: w, error, loading, reload } = useApi<Detail>(`/company/workers/${id}`);
  const [edit, setEdit] = useState(false);
  const [toggle, setToggle] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading && !w) return <PageLoading />;
  if (error || !w) return <ErrorState error={error} onRetry={reload} />;
  const name = `${w.firstName} ${w.lastName}`;
  const e = w.ewa;

  return (
    <>
      <PageHeader
        back={{ href: "/empresas/trabajadores", label: "Trabajadores" }}
        title={name}
        sub={`${w.position ?? "Sin cargo"} · ${w.site?.name ?? "Sin sede"} · ${w.docType} ${w.docNumber}`}
        action={
          canWrite && (
            <>
              <Button variant="outline" size="md" onClick={() => setEdit(true)}><PencilIcon className="text-green-700" />Editar información</Button>
              {w.status !== "RETIRED" &&
                (w.enabled ? (
                  <Button variant="danger-outline" size="md" onClick={() => setToggle(true)}><UserX />Deshabilitar</Button>
                ) : (
                  <Button size="md" onClick={() => setToggle(true)}><UserCheck />Habilitar</Button>
                ))}
            </>
          )
        }
      />

      {msg && <Notice onClose={() => setMsg(null)}>{msg}</Notice>}
      {!w.enabled && w.disabledReason && <Notice tone="amber">Deshabilitado: {w.disabledReason}</Notice>}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card tone="mint" className="flex flex-col gap-5 p-4 max-lg:min-w-0 sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar name={name} className="size-16" />
            <div className="flex flex-col gap-1.5 max-lg:min-w-0">
              <div className="flex flex-wrap gap-2">
                <WorkerBadge value={w.status} />
                <Badge tone={w.enabled ? "green" : "gray"}>{w.enabled ? "Acceso habilitado" : "Sin acceso"}</Badge>
              </div>
              <span className="text-[13px] font-semibold text-green-800 max-lg:break-words">{w.email}{w.phone ? ` · ${w.phone}` : ""}</span>
            </div>
          </div>
          <Facts
            items={[
              ["Salario base", money(w.baseSalary)],
              ["Contrato", w.contractType ?? "—"],
              ["Ingreso", dateFmt(w.hireDate)],
              ["Sede", w.site ? `${w.site.name}` : "—"],
            ]}
          />
        </Card>

        <SectionCard>
          <CardHead title="Salario disponible (EWA)" sub="Cálculo del periodo abierto" />
          {e ? (
            <>
              <Facts
                cols={4}
                items={[
                  ["Neto devengado", money(e.netEarned)],
                  ["Disponible", money(e.available)],
                  ["Recomendado", money(e.recommended)],
                  ["Usado", money(e.used)],
                ]}
              />
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[13px] font-bold text-ink-2">
                  <span>Uso del tope</span>
                  <span className="tabular-nums">{pct(e.usagePct, 0)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-green-100">
                  <div className={cn("h-full rounded-full", e.usagePct >= 70 ? "bg-linear-to-r from-[#f2c14e] to-warning-icon" : "bg-linear-to-r from-green-300 to-green-600")} style={{ width: `${Math.min(e.usagePct, 100)}%` }} />
                </div>
              </div>
              {e.blockers.length > 0 && (
                <ul className="flex flex-col gap-1.5 rounded-md bg-warning-soft/60 p-3">
                  {e.blockers.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm font-semibold text-warning [&_svg]:size-4"><Info />{b}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <EmptyState title="Sin cálculo disponible" text="El trabajador no tiene información de nómina en el periodo abierto." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard>
          <CardHead title="Validación de identidad" action={<KycBadge value={w.kycStatus} />} />
          {w.kycChecks.length ? (
            <ul className="flex flex-col gap-2.5">
              {w.kycChecks.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{kycType[k.type] ?? k.type}{k.score != null && <span className="text-ink-3"> · {Math.round(k.score * 100)}%</span>}</span>
                  <KycBadge value={k.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ShieldCheck} title="Sin validaciones" text="Aún no inicia el registro en la app." className="py-4" />
          )}
        </SectionCard>
        <SectionCard>
          <CardHead title="Autorizaciones" sub="Documentos legales aceptados" />
          {w.consents.length ? (
            <ul className="flex flex-col gap-2.5">
              {w.consents.map((c) => (
                <li key={c.id} className="flex flex-col text-sm">
                  <span className="font-semibold text-ink">{c.document.title} <span className="text-ink-3">v{c.document.version}</span></span>
                  <span className="text-[13px] font-medium text-ink-2">Aceptado el {dateFmt(c.acceptedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin autorizaciones" text="Sin la autorización de descuento no puede retirar." className="py-4" />
          )}
        </SectionCard>
        <SectionCard>
          <CardHead title="Cuentas de destino" />
          {w.accounts.length ? (
            <ul className="flex flex-col gap-2.5">
              {w.accounts.map((a, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{a.bank} <span className="text-ink-3">· {accountType[a.type] ?? a.type}</span></span>
                  {a.isDefault && <Badge>Principal</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin cuentas registradas" className="py-4" />
          )}
        </SectionCard>
      </div>

      <SectionCard>
        <CardHead title="Anticipos" sub="Últimas 20 solicitudes" action={<Link href={`/empresas/operaciones?workerId=${w.id}`} className="text-[13px] font-bold text-green-700 hover:underline">Ver en operaciones</Link>} />
        {w.advances.length ? (
          <Table>
            <thead><tr><Th>Código</Th><Th>Fecha</Th><Th className="text-right">Monto</Th><Th className="text-right">Disponible al pedir</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {w.advances.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-mint-1">
                  <Td><Link href={`/empresas/operaciones/${a.id}`} className="font-bold text-green-700 hover:underline">{a.code}</Link></Td>
                  <Td className="text-ink-2">{dateFmt(a.createdAt)}</Td>
                  <Td className="text-right font-bold tabular-nums">{money(a.amount)}</Td>
                  <Td className="text-right text-ink-2 tabular-nums">{money(a.availableAtRequest)}</Td>
                  <Td><AdvanceBadge value={a.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Sin anticipos" text="Este trabajador aún no ha usado Flexa." />
        )}
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard>
          <CardHead title="Novedades de nómina" action={<Link href="/empresas/nomina?tab=novedades" className="text-[13px] font-bold text-green-700 hover:underline">Registrar novedad</Link>} />
          {w.novelties.length ? (
            <ul className="flex flex-col divide-y divide-line-soft">
              {w.novelties.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex flex-col">
                    <span className="font-bold text-ink">{noveltyTypes[n.type] ?? n.type}</span>
                    <span className="text-[13px] font-medium text-ink-2">{n.description}</span>
                  </span>
                  <span className="text-right text-[13px] font-semibold text-ink-2 tabular-nums">
                    {dateFmt(n.date)}
                    <br />
                    {n.days ? `${n.days} días` : n.amount ? money(n.amount) : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin novedades" className="py-4" />
          )}
        </SectionCard>
        <SectionCard>
          <CardHead title="Incidencias" />
          {w.incidents.length ? (
            <ul className="flex flex-col divide-y divide-line-soft">
              {w.incidents.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex flex-col">
                    <span className="font-bold text-ink">{i.title}</span>
                    <span className="text-[13px] font-medium text-ink-2">{dateFmt(i.createdAt)}</span>
                  </span>
                  <IncidentBadge value={i.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin incidencias" className="py-4" />
          )}
        </SectionCard>
      </div>

      <Dialog open={edit} onClose={() => setEdit(false)} wide title="Editar información laboral" sub="Los cambios quedan registrados en la trazabilidad.">
        {edit && (
          <WorkerForm
            worker={w}
            onCancel={() => setEdit(false)}
            onSaved={() => {
              setEdit(false);
              setMsg("Información actualizada.");
              reload();
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={toggle}
        onClose={() => setToggle(false)}
        title={w.enabled ? `Deshabilitar a ${w.firstName}` : `Habilitar a ${w.firstName}`}
        text={w.enabled ? "No podrá solicitar anticipos hasta que lo habilites de nuevo. Sus solicitudes en curso no se cancelan." : "Podrá crear su cuenta y solicitar anticipos según las reglas de la empresa."}
        confirm={w.enabled ? "Deshabilitar" : "Habilitar"}
        danger={w.enabled}
        note={w.enabled ? { label: "Motivo", placeholder: "Ej. Proceso disciplinario, licencia…" } : undefined}
        onConfirm={async (reason) => {
          await api(`/company/workers/${w.id}/access`, { body: { enabled: !w.enabled, reason: reason || undefined } });
          setMsg(w.enabled ? "Acceso deshabilitado." : "Acceso habilitado.");
          reload();
        }}
      />
    </>
  );
}
