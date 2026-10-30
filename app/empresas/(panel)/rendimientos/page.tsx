import { PageHeader } from "@/components/flexa/company-shell";
import { Pending } from "@/components/flexa/empty";

export default function Returns() {
  return (
    <>
      <PageHeader title="Rendimientos" sub="Conciliación entre anticipos entregados y descuentos de nómina." />
      <Pending title="Sección en definición" text="El equipo de Flexa está definiendo qué indicadores incluye esta vista. Se diseña cuando llegue el documento maestro." />
    </>
  );
}
