import { Bus, Droplets, Flame, Smartphone, Sparkles, Wifi, Zap } from "@/components/flexa/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { Badge, Card, IconBox } from "@/components/flexa/ui";

// Each category gets its own soft tint so the grid reads at a glance.
const services = [
  { icon: Zap, label: "Energía", sub: "Emcali, EPM, Celsia", tint: "bg-[#fff1cc] text-[#946200]" },
  { icon: Droplets, label: "Agua", sub: "Acueducto de tu ciudad", tint: "bg-[#e1eefb] text-[#2a5d97]" },
  { icon: Flame, label: "Gas natural", sub: "Gases de Occidente, Vanti", tint: "bg-[#fde6dc] text-[#b04a1f]" },
  { icon: Wifi, label: "Internet y TV", sub: "Claro, Movistar, Tigo", tint: "bg-teal-soft text-teal" },
  { icon: Smartphone, label: "Recargas", sub: "Todos los operadores", tint: "bg-[#e2f2de] text-green-600" },
  { icon: Bus, label: "Transporte", sub: "MIO, TransMilenio", tint: "bg-[#ece6f7] text-[#5a3f94]" },
];

export default function Services() {
  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Otros servicios" />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-10">
        <Card tone="mint" className="relative isolate flex flex-col gap-3 overflow-hidden p-5">
          <Blob shape={2} tone="deep" className="-right-14 -bottom-16 -z-10 size-48 opacity-80" />
          <IconBox tone="solid" size="lg">
            <Sparkles />
          </IconBox>
          <div className="flex flex-col gap-1">
            <h2 className="text-h2 text-ink">Paga tus servicios con lo que ya ganaste</h2>
            <p className="max-w-[30ch] text-sm font-medium text-green-900">
              Muy pronto podrás pagar tus cuentas desde tu salario disponible, sin salir de Flexa.
            </p>
          </div>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">Categorías</h2>
          <ul className="grid grid-cols-2 gap-3">
            {services.map(({ icon: Icon, label, sub, tint }) => (
              <li key={label}>
                <Card tone="soft" className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <IconBox className={tint}>
                      <Icon />
                    </IconBox>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-ink">{label}</span>
                    <span className="text-[13px] font-medium text-ink-2">{sub}</span>
                  </div>
                  <Badge className="mt-auto h-6 self-start bg-green-100 px-2.5 text-green-700">Próximamente</Badge>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
