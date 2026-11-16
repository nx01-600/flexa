"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Plus, X } from "@/components/flexa/icons";
import { Async, ErrorText, Labeled, PageHeader, Status, type CompanyRow } from "@/components/flexa/admin/admin-ui";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Table, Td, Th } from "@/components/flexa/table";
import { Button, Card, Input } from "@/components/flexa/ui";
import { api, ApiError, money, useApi } from "@/lib/api";

const empty = { name: "", nit: "", pricePerWorker: "9900", adminName: "", adminEmail: "", adminPassword: "" };

function CreateCompany({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/companies", { body: { ...f, pricePerWorker: Number(f.pricePerWorker) || 0 } });
      setF(empty);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la empresa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="soft" className="p-6">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <CardHead
          title="Nueva empresa cliente"
          sub="Se crea en vinculación, sin integración configurada, con su primer usuario de Talento Humano."
          action={
            <button type="button" onClick={onCancel} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-green-100 [&_svg]:size-5">
              <X />
            </button>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Labeled label="Razón social">
            <Input required value={f.name} onChange={set("name")} className="h-11" />
          </Labeled>
          <Labeled label="NIT">
            <Input required value={f.nit} onChange={set("nit")} className="h-11" placeholder="900123456-7" />
          </Labeled>
          <Labeled label="Precio por trabajador (COP/mes)">
            <Input type="number" min={0} value={f.pricePerWorker} onChange={set("pricePerWorker")} className="h-11 tabular-nums" />
          </Labeled>
          <Labeled label="Nombre del administrador">
            <Input required value={f.adminName} onChange={set("adminName")} className="h-11" />
          </Labeled>
          <Labeled label="Correo del administrador">
            <Input required type="email" value={f.adminEmail} onChange={set("adminEmail")} className="h-11" />
          </Labeled>
          <Labeled label="Contraseña inicial">
            <Input required minLength={8} type="password" autoComplete="new-password" value={f.adminPassword} onChange={set("adminPassword")} className="h-11" />
          </Labeled>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Creando…" : "Crear empresa"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function Companies() {
  const state = useApi<CompanyRow[]>("/admin/companies");
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Empresas"
        sub="Clientes, estado del servicio y suscripción mensual."
        action={
          !creating && (
            <Button size="md" onClick={() => setCreating(true)}>
              <Plus />
              Nueva empresa
            </Button>
          )
        }
      />
      {creating && (
        <CreateCompany
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            state.reload();
          }}
        />
      )}
      <Async state={state} isEmpty={(d) => d.length === 0} empty="Aún no hay empresas cliente.">
        {(rows) => (
          <Card className="p-4">
            <Table>
              <thead>
                <tr>
                  <Th>Empresa</Th>
                  <Th>Estado</Th>
                  <Th>Integración</Th>
                  <Th className="text-right">Habilitados</Th>
                  <Th className="text-right">Precio</Th>
                  <Th className="text-right">Ingreso mensual</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-mint-1/60">
                    <Td>
                      <Link href={`/admin/empresas/${c.id}`} className="flex flex-col leading-tight hover:text-green-700">
                        <span className="font-bold">{c.name}</span>
                        <span className="text-xs font-semibold text-ink-3">NIT {c.nit}</span>
                      </Link>
                    </Td>
                    <Td>
                      <Status value={c.status} />
                    </Td>
                    <Td>
                      <Status value={c.integrationStatus} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      {c.enabledWorkers} <span className="text-ink-3">/ {c._count.workers}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{money(c.pricePerWorker)}</Td>
                    <Td className="text-right font-bold tabular-nums">{money(c.monthlyRevenue)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </Async>
    </>
  );
}
