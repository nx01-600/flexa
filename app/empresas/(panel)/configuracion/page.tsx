"use client";

import { useState, type FormEvent } from "react";
import { Building2, MapPin, Plus } from "@/components/flexa/icons";
import { PageHeader } from "@/components/flexa/company-shell";
import { dateTime, Dialog, ErrorState, FormField, IntegrationBadge, Loading, Notice, PageLoading, ReadOnlyHint, roleLabel, SectionCard, Select, TextInput, useAction, useCanWrite, useCompanySession } from "@/components/flexa/empresas/kit";
import type { Settings, Site } from "@/components/flexa/empresas/types";
import { Avatar, CardHead, Toggle } from "@/components/flexa/empresas-ui";
import { Blob } from "@/components/flexa/shapes";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card, IconBox } from "@/components/flexa/ui";
import { api, ApiError, money, useApi } from "@/lib/api";

type Company = {
  name: string;
  nit: string;
  status: string;
  pricePerWorker: number;
  integrationType: string;
  integrationStatus: string;
  erpName: string | null;
  workers: number;
  enabledWorkers: number;
  monthlySubscription: number;
};
type Member = { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null };

export default function SettingsPage() {
  const canWrite = useCanWrite();
  const company = useApi<Company>("/company");
  const c = company.data;
  if (company.loading && !c) return <PageLoading />;
  if (company.error || !c) return <ErrorState error={company.error} onRetry={company.reload} />;
  return (
    <>
      <PageHeader title="Configuración" sub="Datos de la empresa, reglas de anticipos, sedes y cuentas de tu equipo." />

      <Card tone="mint" className="relative isolate flex flex-wrap items-center gap-6 overflow-hidden p-6">
        <Blob shape={2} tone="deep" className="-top-20 -right-16 -z-10 h-[220px] w-[360px] opacity-60" />
        <IconBox tone="solid" size="lg" halo className="ring-white/70"><Building2 /></IconBox>
        <div className="flex flex-1 flex-col gap-0.5">
          <h2 className="text-h2 text-green-900">{c.name}</h2>
          <p className="text-sm font-semibold text-green-800">NIT {c.nit} · {c.integrationType === "ERP_API" ? `ERP ${c.erpName ?? ""}` : "Carga por archivo"}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Trabajadores", c.workers],
            ["Habilitados", c.enabledWorkers],
            ["Suscripción mensual", money(c.monthlySubscription)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-white/80 px-4 py-3 shadow-xs">
              <p className="text-[13px] font-semibold text-ink-2">{k}</p>
              <p className="text-lg font-extrabold text-ink tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex w-full items-center gap-3 text-[13px] font-semibold text-green-800">
          Integración <IntegrationBadge value={c.integrationStatus} /> · {money(c.pricePerWorker)} por trabajador habilitado
        </div>
      </Card>

      <RulesForm canWrite={canWrite} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
        <SitesCard canWrite={canWrite} />
        <TeamCard canWrite={canWrite} />
      </div>
    </>
  );
}

// ---------- Reglas ----------

const ruleFields: { key: keyof Settings; label: string; hint: string; unit?: "%" | "$" | "días" }[] = [
  { key: "maxAdvancePct", label: "Tope de anticipo", hint: "Porcentaje máximo del neto devengado que se puede retirar.", unit: "%" },
  { key: "recommendedPct", label: "Recomendado", hint: "Referencia de uso sano; no bloquea. No puede superar el tope.", unit: "%" },
  { key: "minAmount", label: "Monto mínimo por solicitud", hint: "No puede superar el máximo.", unit: "$" },
  { key: "maxAmountPerRequest", label: "Monto máximo por solicitud", hint: "Límite por cada retiro.", unit: "$" },
  { key: "maxRequestsPerPeriod", label: "Solicitudes por periodo", hint: "Cantidad máxima de retiros en el periodo." },
  { key: "feePerRequest", label: "Comisión por solicitud", hint: "La paga el trabajador; 0 si la asume la empresa.", unit: "$" },
  { key: "blackoutDaysBeforePay", label: "Días de bloqueo antes del pago", hint: "Sin solicitudes en estos días previos a la nómina.", unit: "días" },
  { key: "exceptionAmount", label: "Revisión manual desde", hint: "Solicitudes iguales o mayores quedan en excepción.", unit: "$" },
  { key: "alarmUsagePct", label: "Alarma Flexa por uso del tope", hint: "Avisa al trabajador al superar este porcentaje.", unit: "%" },
  { key: "alarmRequestsCount", label: "Alarma Flexa por número de retiros", hint: "Avisa al llegar a esta cantidad en el periodo." },
];

function RulesForm({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useApi<Settings>("/company/settings");
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading rows={4} />;
  if (!data) return null;
  const v = { ...data, ...draft };
  const dirty = Object.keys(draft).some((k) => draft[k as keyof Settings] !== data[k as keyof Settings]);
  const localError = v.recommendedPct > v.maxAdvancePct ? "El recomendado no puede superar el tope." : v.minAmount > v.maxAmountPerRequest ? "El mínimo no puede superar el máximo por solicitud." : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setFieldErrors([]);
    const changes = Object.fromEntries(Object.entries(draft).filter(([k, val]) => val !== data![k as keyof Settings]));
    const ok = await action.run(async () => {
      try {
        return await api<Settings>("/company/settings", { method: "PATCH", body: changes });
      } catch (err) {
        if (err instanceof ApiError && Array.isArray(err.body.message)) setFieldErrors(err.body.message);
        throw err;
      }
    });
    if (ok) {
      setDraft({});
      setSaved(true);
      reload();
    }
  }

  return (
    <SectionCard>
      <CardHead title="Reglas de anticipos" sub="Se aplican a cada solicitud de tus trabajadores. Los cambios quedan en la trazabilidad." />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {ruleFields.map((f) => (
            <FormField key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ""}`} hint={f.hint}>
              <TextInput
                type="number"
                min={0}
                max={f.unit === "%" ? 100 : undefined}
                step={1}
                required
                disabled={!canWrite}
                value={v[f.key] as number}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((d) => ({ ...d, [f.key]: e.target.value === "" ? 0 : Math.round(Number(e.target.value)) }));
                }}
              />
            </FormField>
          ))}
          <FormField label="Frecuencia de pago" hint="Define la longitud de los periodos.">
            <Select
              disabled={!canWrite}
              value={v.payFrequency}
              onChange={(e) => setDraft((d) => ({ ...d, payFrequency: e.target.value as Settings["payFrequency"] }))}
              options={[{ value: "MONTHLY", label: "Mensual" }, { value: "BIWEEKLY", label: "Quincenal" }]}
            />
          </FormField>
        </div>
        {localError && dirty && <Notice tone="amber">{localError}</Notice>}
        {action.error && (
          <Notice tone="red">
            {action.error}
            {fieldErrors.length > 1 && (
              <ul className="mt-1 list-disc pl-5 font-medium">
                {fieldErrors.slice(1).map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
          </Notice>
        )}
        {saved && <Notice onClose={() => setSaved(false)}>Reglas actualizadas.</Notice>}
        {canWrite ? (
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" disabled={!dirty} onClick={() => setDraft({})}>Descartar</Button>
            <Button type="submit" size="md" disabled={!dirty || action.busy}>{action.busy ? "Guardando…" : "Guardar reglas"}</Button>
          </div>
        ) : (
          <ReadOnlyHint />
        )}
      </form>
    </SectionCard>
  );
}

// ---------- Sedes ----------

function SitesCard({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useApi<Site[]>("/company/sites");
  const [open, setOpen] = useState(false);
  const { busy, error: e2, run } = useAction();
  return (
    <SectionCard>
      <CardHead title="Sedes" sub="Para filtrar trabajadores y reportes" action={canWrite && <Button variant="soft" size="sm" onClick={() => setOpen(true)}><Plus />Agregar</Button>} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading rows={4} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-md bg-[#f6faf5] p-3">
              <IconBox tone="white" size="sm"><MapPin /></IconBox>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-bold text-ink">{s.name}</span>
                <span className="text-[13px] font-medium text-ink-2">{s.city}</span>
              </span>
              <span className="text-sm font-semibold text-ink-2 tabular-nums">{s._count?.workers ?? 0} trabajadores</span>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva sede"
        onSubmit={async (e) => {
          const f = new FormData(e.currentTarget);
          const ok = await run(() => api("/company/sites", { body: { name: String(f.get("name")).trim(), city: String(f.get("city")).trim() } }));
          if (ok) {
            setOpen(false);
            reload();
          }
        }}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Agregar sede"}</Button>
          </>
        }
      >
        <FormField label="Nombre"><TextInput name="name" required placeholder="Sede Pereira" /></FormField>
        <FormField label="Ciudad"><TextInput name="city" required placeholder="Pereira" /></FormField>
        {e2 && <Notice tone="red">{e2}</Notice>}
      </Dialog>
    </SectionCard>
  );
}

// ---------- Equipo ----------

function TeamCard({ canWrite }: { canWrite: boolean }) {
  const session = useCompanySession();
  const { data, error, loading, reload } = useApi<Member[]>("/company/team");
  const [open, setOpen] = useState(false);
  const create = useAction();
  const toggle = useAction();
  return (
    <SectionCard>
      <CardHead title="Equipo" sub="Personas con acceso a Flexa Empresas" action={canWrite && <Button size="sm" onClick={() => setOpen(true)}><Plus />Crear cuenta</Button>} />
      {toggle.error && <Notice tone="red" onClose={() => toggle.setError(null)}>{toggle.error}</Notice>}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading rows={3} />
      ) : (
        <Table>
          <thead><tr><Th>Persona</Th><Th>Rol</Th><Th>Último ingreso</Th><Th className="text-right">Activa</Th></tr></thead>
          <tbody>
            {data?.map((m) => {
              const self = m.id === session?.user.sub;
              return (
                <tr key={m.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <span className="flex flex-col">
                        <span className="font-bold">{m.name}{self && <span className="font-semibold text-ink-3"> · tú</span>}</span>
                        <span className="text-xs font-medium text-ink-3">{m.email}</span>
                      </span>
                    </span>
                  </Td>
                  <Td><Badge tone={m.role === "COMPANY_ADMIN" ? "green" : "teal"}>{roleLabel[m.role]}</Badge></Td>
                  <Td className="text-ink-2">{m.lastLoginAt ? dateTime(m.lastLoginAt) : "Nunca"}</Td>
                  <Td className="text-right">
                    {canWrite && !self ? (
                      <span className="inline-flex">
                        <Toggle
                          on={m.active}
                          label={`${m.active ? "Desactivar" : "Activar"} a ${m.name}`}
                          onChange={async (active) => {
                            const ok = await toggle.run(() => api(`/company/team/${m.id}`, { method: "PATCH", body: { active } }));
                            if (ok) reload();
                          }}
                        />
                      </span>
                    ) : (
                      <Badge tone={m.active ? "green" : "gray"}>{m.active ? "Activa" : "Inactiva"}</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Crear cuenta"
        sub="Comparte la contraseña temporal por un canal seguro."
        onSubmit={async (e) => {
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          const ok = await create.run(() => api("/company/team", { body: f }));
          if (ok) {
            setOpen(false);
            reload();
          }
        }}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={create.busy}>{create.busy ? "Creando…" : "Crear cuenta"}</Button>
          </>
        }
      >
        <FormField label="Nombre"><TextInput name="name" required /></FormField>
        <FormField label="Correo corporativo"><TextInput name="email" type="email" required /></FormField>
        <FormField label="Rol" hint="El financiero solo consulta; el administrador puede hacer cambios.">
          <Select name="role" options={[{ value: "COMPANY_ADMIN", label: "Administrador" }, { value: "COMPANY_FINANCE", label: "Financiero" }]} />
        </FormField>
        <FormField label="Contraseña temporal" hint="Mínimo 8 caracteres."><TextInput name="password" type="password" minLength={8} required autoComplete="new-password" /></FormField>
        {create.error && <Notice tone="red">{create.error}</Notice>}
      </Dialog>
    </SectionCard>
  );
}
