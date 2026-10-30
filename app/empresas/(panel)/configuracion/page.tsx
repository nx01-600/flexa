import { Plus } from "lucide-react";
import { PageHeader } from "@/components/flexa/company-shell";
import { Table, Td, Th } from "@/components/flexa/table";
import { Badge, Button, Card } from "@/components/flexa/ui";
import { company, team } from "@/lib/mock";

export default function Settings() {
  return (
    <>
      <PageHeader
        title="Configuración"
        sub="Datos de la empresa y cuentas de tu equipo."
        action={<Button size="md"><Plus />Crear cuenta</Button>}
      />

      <Card className="grid gap-x-10 p-5 sm:grid-cols-3">
        {[
          ["Razón social", company.name],
          ["NIT", company.nit],
          ["Sedes", "Cali, Bogotá, Medellín, Barranquilla, Bucaramanga"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 py-2">
            <span className="text-xs font-bold text-ink-2">{k}</span>
            <span className="text-sm font-semibold text-ink">{v}</span>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-2 pt-5">
        <div className="flex flex-col gap-1 px-5">
          <h2 className="text-base font-bold text-ink">Cuentas del equipo</h2>
          <p className="text-sm text-ink-2">El administrador crea cada cuenta, le asigna un rol y entrega la contraseña al área.</p>
        </div>
        <Table>
          <thead>
            <tr><Th className="pl-5">Nombre</Th><Th>Correo</Th><Th className="pr-5">Rol</Th></tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-0">
            {team.map((t) => (
              <tr key={t.email} className="hover:bg-green-50/60">
                <Td className="pl-5 font-semibold">{t.name}</Td>
                <Td className="text-ink-2">{t.email}</Td>
                <Td className="pr-5"><Badge tone={t.role === "Administrador" ? "green" : "gray"}>{t.role}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
