import Link from "next/link";
import { ArrowUp, Banknote, CalendarClock, ChevronRight, FileSpreadsheet, FileText, HandCoins, Scale, Smartphone, TriangleAlert, Users } from "lucide-react";
import { Bars } from "@/components/flexa/charts";
import { PageHeader } from "@/components/flexa/company-shell";
import { Avatar, CardHead, Kpi, MoreLink } from "@/components/flexa/empresas-ui";
import { Period } from "@/components/flexa/period";
import { Blob } from "@/components/flexa/shapes";
import { ButtonLink, Card, IconBox } from "@/components/flexa/ui";
import { company, companyWeekly, employees, money } from "@/lib/mock";

const accessPct = Math.round((company.withAccess / company.activeWorkers) * 100);

const notices = [
  { icon: FileSpreadsheet, title: "Nómina del próximo periodo", sub: "Cargada · 15 oct 2026", href: "/empresas/nomina", tone: "green" as const },
  { icon: Scale, title: "Rendimientos y conciliación", sub: "Todo al día", href: "/empresas/rendimientos", tone: "teal" as const },
  { icon: TriangleAlert, title: "Alertas", sub: "3 trabajadores con uso alto de retiros", href: "/empresas/trabajadores", tone: "amber" as const },
  { icon: FileText, title: "Reportes", sub: "Descarga tus reportes aquí", href: "/empresas/estadisticas", tone: "green" as const },
];

const recent = [
  { name: employees[0].name, site: employees[0].site, amount: 200_000, when: "Hoy, 10:24 a. m." },
  { name: employees[1].name, site: employees[1].site, amount: 150_000, when: "Hoy, 8:02 a. m." },
  { name: employees[2].name, site: employees[2].site, amount: 120_000, when: "Ayer, 6:45 p. m." },
  { name: employees[5].name, site: employees[5].site, amount: 50_000, when: "Ayer, 12:10 p. m." },
];

export default function CompanyHome() {
  const monthTotal = companyWeekly.reduce((a, w) => a + w.value, 0);
  return (
    <>
      <PageHeader
        title={`¡Hola, ${company.name}!`}
        sub="Aquí tienes un resumen de la actividad de tu empresa este mes."
        action={<Period options={["Octubre 2026", "Septiembre 2026", "Agosto 2026"]} />}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={Users} value={company.activeWorkers} label="Trabajadores activos" tone="green" />
        <Kpi icon={Smartphone} value={company.withAccess} label="Con acceso a Flexa" tone="teal" trend={`${accessPct}%`} />
        <Kpi icon={HandCoins} value={company.withdrawalsMonth} label="Retiros este mes" tone="amber" trend={<><ArrowUp className="size-3.5 stroke-[2.5]" />8%</>} />
        <Kpi icon={Banknote} value={money(company.withdrawnMonth)} label="Total retirado este mes" tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card className="flex flex-col gap-5 p-6">
          <CardHead title="Retiros de los trabajadores" sub="Monto retirado por semana" href="/empresas/estadisticas" />
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-ink-2">Total del mes</span>
              <span className="text-[22px] font-extrabold tracking-[-0.03em] text-ink tabular-nums">{money(monthTotal)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-ink-2">Retiro promedio</span>
              <span className="text-[22px] font-extrabold tracking-[-0.03em] text-ink tabular-nums">{money(company.withdrawnMonth / company.withdrawalsMonth)}</span>
            </div>
          </div>
          <Bars data={companyWeekly} x="week" height={250} highlightLast={false} />
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <CardHead title="Información relevante" />
          <ul className="flex flex-1 flex-col justify-between gap-2.5">
            {notices.map(({ icon: Icon, title, sub, href, tone }) => (
              <li key={title}>
                <Link href={href} className="group flex items-center gap-3.5 rounded-md bg-[#f6faf5] p-3.5 transition-colors duration-150 hover:bg-mint-2">
                  <IconBox tone={tone}><Icon /></IconBox>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-bold text-ink">{title}</span>
                    <span className="truncate text-[13px] font-medium text-ink-2">{sub}</span>
                  </span>
                  <ChevronRight className="size-[18px] text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-green-700" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.45fr]">
        <Card tone="mint" className="relative isolate flex flex-col justify-between gap-5 overflow-hidden p-6">
          <Blob shape={0} tone="deep" className="-right-16 -bottom-20 -z-10 size-[240px] opacity-60" />
          <div className="flex items-center gap-3.5">
            <IconBox tone="dark" size="lg"><CalendarClock /></IconBox>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-green-800">Próxima nómina</span>
              <span className="text-h2 text-green-900">15 de noviembre</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px] font-bold text-green-900">
              <span>Periodo en curso</span>
              <span className="tabular-nums">Día 15 de 30</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/70">
              <div className="h-full w-1/2 rounded-full bg-btn-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-white/80 p-3.5 shadow-xs">
              <span className="text-[13px] font-semibold text-ink-2">A descontar</span>
              <p className="text-lg font-extrabold tracking-[-0.02em] text-ink tabular-nums">{money(company.withdrawnMonth)}</p>
            </div>
            <div className="rounded-md bg-white/80 p-3.5 shadow-xs">
              <span className="text-[13px] font-semibold text-ink-2">Trabajadores</span>
              <p className="text-lg font-extrabold tracking-[-0.02em] text-ink tabular-nums">{company.withAccess}</p>
            </div>
          </div>
          <ButtonLink href="/empresas/nomina" size="md">Cargar nómina</ButtonLink>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <CardHead title="Últimos retiros" sub="Movimientos recientes de tus trabajadores" action={<MoreLink href="/empresas/trabajadores">Ver todos</MoreLink>} />
          <ul className="flex flex-col">
            {recent.map((r) => (
              <li key={r.name + r.when} className="flex h-16 items-center gap-3.5 border-b border-line-soft last:border-0">
                <Avatar name={r.name} className="size-10" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-bold text-ink">{r.name}</span>
                  <span className="text-[13px] font-medium text-ink-2">Sede {r.site} · {r.when}</span>
                </span>
                <span className="text-[15px] font-bold text-ink tabular-nums">{money(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
