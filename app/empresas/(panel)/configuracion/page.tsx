"use client";

import { Building2, CalendarDays, Lock, MapPin, Percent, Plus, Repeat } from "@/components/flexa/icons";
import { useState } from "react";
import { PageHeader } from "@/components/flexa/company-shell";
import { Avatar, CardHead, Kebab, Toggle } from "@/components/flexa/empresas-ui";
import { Blob } from "@/components/flexa/shapes";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card, IconBox } from "@/components/flexa/ui";
import { company, team } from "@/lib/mock";

const sedes = ["Cali", "Bogotá", "Medellín", "Barranquilla", "Bucaramanga"];

const roleTone = { Administrador: "green", "Recursos Humanos": "teal", Finanzas: "amber" } as const;

const params = [
  { icon: Percent, k: "Porcentaje máximo de retiro", v: "60% del salario devengado" },
  { icon: CalendarDays, k: "Días de corte", v: "2 días antes de cada pago" },
  { icon: Repeat, k: "Periodicidad", v: "Quincenal (15 y 30)" },
];

export default function Settings() {
  const [notify, setNotify] = useState({ payroll: true, alerts: true, weekly: false });
  const notices = [
    { key: "payroll", title: "Recordatorio de carga de nómina", sub: "Te avisamos 3 días antes de cada corte." },
    { key: "alerts", title: "Alertas de uso alto", sub: "Cuando un trabajador supera el 70% de su disponible." },
    { key: "weekly", title: "Resumen semanal por correo", sub: "Retiros, conciliación y novedades de la semana." },
  ] as const;

  return (
    <>
      <PageHeader
        title="Configuración"
        sub="Datos de la empresa, parámetros y cuentas de tu equipo."
        action={<Button size="md"><Plus />Crear cuenta</Button>}
      />

      <Card tone="mint" className="relative isolate flex items-center gap-6 overflow-hidden p-6">
        <Blob shape={2} tone="deep" className="-top-20 -right-16 -z-10 h-[220px] w-[360px] opacity-60" />
        <IconBox tone="solid" size="lg" halo className="ring-white/70"><Building2 /></IconBox>
        <div className="flex flex-1 flex-col gap-1.5">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-green-900">{company.name}</h2>
          <p className="text-sm font-semibold text-green-800">NIT {company.nit} · {company.activeWorkers} trabajadores</p>
          <div className="mt-2 flex flex-wrap gap-2">
          {sedes.map((s) => (
            <span key={s} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/85 px-3 text-[13px] font-bold text-green-900 shadow-xs [&_svg]:size-3.5">
              <MapPin className="text-green-600" />{s}
            </span>
          ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="flex flex-col gap-4 p-6">
          <CardHead title="Parámetros de retiro" sub="Definidos con Flexa durante la prueba piloto" action={<Badge tone="gray"><Lock className="mr-1 size-3.5" />Solo lectura</Badge>} />
          <ul className="flex flex-col gap-2.5">
            {params.map(({ icon: Icon, k, v }) => (
              <li key={k} className="flex items-center gap-3.5 rounded-md bg-[#f6faf5] p-3.5">
                <IconBox><Icon /></IconBox>
                <span className="flex flex-col">
                  <span className="text-[13px] font-semibold text-ink-2">{k}</span>
                  <span className="text-[15px] font-bold text-ink">{v}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <CardHead title="Notificaciones" sub="Elige qué avisos recibe el administrador" />
          <ul className="flex flex-col">
            {notices.map((n) => (
              <li key={n.key} className="flex items-center gap-4 border-b border-line-soft py-4 last:border-0">
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-bold text-ink">{n.title}</span>
                  <span className="text-[13px] font-medium text-ink-2">{n.sub}</span>
                </span>
                <Toggle label={n.title} on={notify[n.key]} onChange={(v) => setNotify((s) => ({ ...s, [n.key]: v }))} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <CardHead title="Cuentas del equipo" sub="El administrador crea cada cuenta, le asigna un rol y entrega la contraseña al área." />
        <Table>
          <thead>
            <tr><Th>Nombre</Th><Th>Correo</Th><Th>Rol</Th><Th>Último acceso</Th><Th className="w-14"><span className="sr-only">Acciones</span></Th></tr>
          </thead>
          <tbody>
            {team.map((t, i) => (
              <tr key={t.email} className="transition-colors hover:bg-mint-1">
                <Td>
                  <span className="flex items-center gap-3"><Avatar name={t.name} /><span className="font-bold">{t.name}</span></span>
                </Td>
                <Td className="text-ink-2">{t.email}</Td>
                <Td><Badge tone={roleTone[t.role as keyof typeof roleTone] ?? "gray"}>{t.role}</Badge></Td>
                <Td className="text-ink-2">{["Hoy, 9:12 a. m.", "Ayer, 4:30 p. m.", "28 oct 2026"][i] ?? "—"}</Td>
                <Td className="text-right"><Kebab label={`Acciones para ${t.name}`} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
