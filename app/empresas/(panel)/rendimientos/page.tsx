import { PageHeader } from "@/components/flexa/company-shell";
import { ReturnsView } from "@/components/flexa/empresas-returns";
import { Period } from "@/components/flexa/period";

export default function Returns() {
  return (
    <>
      <PageHeader
        title="Rendimientos"
        sub="Conciliación entre anticipos entregados y descuentos de nómina."
        action={<Period options={["Últimos 6 meses", "Últimos 3 meses", "Este año"]} />}
      />
      <ReturnsView />
    </>
  );
}
