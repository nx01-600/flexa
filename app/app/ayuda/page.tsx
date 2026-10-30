import { MessageCircle, Plus } from "lucide-react";
import { TopBar } from "@/components/flexa/app-shell";
import { ButtonLink, Card } from "@/components/flexa/ui";

const faqs = [
  { q: "¿Cuánto puedo retirar?", a: "Entre el 30 % y el 60 % de lo que ya trabajaste en el periodo, según tu perfil. Lo ves en Inicio como «Disponible para retirar»." },
  { q: "¿Cómo se paga lo que retiro?", a: "Se descuenta automáticamente de tu siguiente pago de nómina. No tienes que hacer nada." },
  { q: "¿Es un préstamo?", a: "No. Es tu propio salario, que ya ganaste, entregado antes de la fecha de pago." },
  { q: "¿Cuánto tarda en llegar?", a: "En el prototipo es inmediato. Los tiempos reales dependerán del banco de destino." },
];

export default function Help() {
  return (
    <>
      <TopBar title="Ayuda" />
      <main className="flex flex-col gap-4 px-5 pt-1 pb-8">
        <Card className="divide-y divide-line overflow-hidden">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group px-4 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink">
                {q}
                <Plus className="size-5 shrink-0 text-green-700 transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="mt-2 text-sm text-ink-2">{a}</p>
            </details>
          ))}
        </Card>
        <ButtonLink href="#" variant="outline">
          <MessageCircle />
          Escribir a soporte
        </ButtonLink>
      </main>
    </>
  );
}
