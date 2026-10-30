import Link from "next/link";
import { ArrowUpRight, ChevronRight, FileSpreadsheet, FileText, Scale, Smartphone, TriangleAlert, Users } from "lucide-react";
import { Bars } from "@/components/flexa/charts";
import { PageHeader } from "@/components/flexa/company-shell";
import { Period } from "@/components/flexa/period";
import { Card, IconBox } from "@/components/flexa/ui";
import { company, companyWeekly, money } from "@/lib/mock";

const kpis = [
  { icon: Users, value: String(company.activeWorkers), label: "Trabajadores activos" },
  { icon: Smartphone, value: String(company.withAccess), label: `Con acceso a Flexa (${Math.round((company.withAccess / company.activeWorkers) * 100)} %)` },
  { icon: ArrowUpRight, value: String(company.withdrawalsMonth), label: "Retiros este mes" },
  { icon: FileText, value: money(company.withdrawnMonth), label: "Total retirado este mes" },
];

const notices = [
  { icon: FileSpreadsheet, title: "Nómina del próximo periodo", sub: "Cargada · 15 oct 2026", href: "/empresas/nomina", tone: "green" as const },
  { icon: Scale, title: "Rendimientos y conciliación", sub: "Todo al día", href: "/empresas/rendimientos", tone: "green" as const },
  { icon: TriangleAlert, title: "Alertas", sub: "3 trabajadores con uso alto de retiros", href: "/empresas/trabajadores", tone: "amber" as const },
  { icon: FileText, title: "Reportes", sub: "Descarga tus reportes aquí", href: "/empresas/estadisticas", tone: "green" as const },
];

export default function CompanyHome() {
  return (
    <>
      <PageHeader
        title={`¡Hola, ${company.name}!`}
        sub="Aquí tienes un resumen de la actividad de tu empresa este mes."
        action={<Period options={["Octubre 2026", "Septiembre 2026", "Agosto 2026"]} />}
      />

      <Card className="grid grid-cols-2 divide-line xl:grid-cols-4 xl:divide-x">
        {kpis.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4 px-6 py-5">
            <IconBox className="size-11"><Icon /></IconBox>
            <div className="flex min-w-0 flex-col">
              <span className="text-2xl font-extrabold tracking-[-0.02em] text-ink tabular-nums">{value}</span>
              <span className="text-sm text-ink-2">{label}</span>
            </div>
          </div>
        ))}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Retiros de los trabajadores</h2>
            <Link href="/empresas/estadisticas" className="flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline">
              Ver más <ChevronRight className="size-4" />
            </Link>
          </div>
          <Bars data={companyWeekly} x="week" height={260} />
        </Card>

        <Card className="flex flex-col p-5">
          <h2 className="mb-2 text-base font-bold text-ink">Información relevante</h2>
          <ul className="flex flex-col divide-y divide-line">
            {notices.map(({ icon: Icon, title, sub, href, tone }) => (
              <li key={title}>
                <Link href={href} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3.5 transition-colors hover:bg-green-50">
                  <IconBox tone={tone}><Icon /></IconBox>
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-bold text-ink">{title}</span>
                    <span className="text-xs text-ink-2">{sub}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
