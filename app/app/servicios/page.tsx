import { Bus, Droplets, Flame, Smartphone, Wifi, Zap } from "lucide-react";
import { TopBar } from "@/components/flexa/app-shell";
import { Badge, Card, IconBox } from "@/components/flexa/ui";

const services = [
  { icon: Zap, label: "Energía", sub: "Emcali, EPM, Celsia" },
  { icon: Droplets, label: "Agua y alcantarillado", sub: "Acueducto de tu ciudad" },
  { icon: Flame, label: "Gas natural", sub: "Gases de Occidente, Vanti" },
  { icon: Wifi, label: "Internet y TV", sub: "Claro, Movistar, Tigo" },
  { icon: Smartphone, label: "Recargas de celular", sub: "Todos los operadores" },
  { icon: Bus, label: "Transporte", sub: "MIO, TransMilenio" },
];

export default function Services() {
  return (
    <>
      <TopBar title="Otros servicios" />
      <main className="flex flex-col gap-4 px-5 pt-1 pb-8">
        <p className="text-[15px] text-ink-2">Pronto podrás pagar tus servicios con tu salario disponible, sin salir de Flexa.</p>
        <Card className="divide-y divide-line overflow-hidden">
          {services.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5">
              <IconBox><Icon /></IconBox>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold text-ink">{label}</span>
                <span className="text-xs text-ink-3">{sub}</span>
              </span>
              <Badge tone="gray">Pronto</Badge>
            </div>
          ))}
        </Card>
      </main>
    </>
  );
}
