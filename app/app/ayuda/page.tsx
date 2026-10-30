"use client";

import Link from "next/link";
import { CircleHelp, MessageCircle, Phone, Plus, Search } from "@/components/flexa/icons";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { Card, IconBox, Input } from "@/components/flexa/ui";

const faqs = [
  { q: "¿Cuánto puedo retirar?", a: "Entre el 30% y el 60% de lo que ya trabajaste en el periodo, según tu perfil. Lo ves en Inicio como «Disponible para retirar»." },
  { q: "¿Cómo se paga lo que retiro?", a: "Se descuenta automáticamente de tu siguiente pago de nómina. No tienes que hacer nada." },
  { q: "¿Es un préstamo?", a: "No. Es tu propio salario, que ya ganaste, entregado antes de la fecha de pago." },
  { q: "¿Cuánto tarda en llegar?", a: "En el prototipo es inmediato. Los tiempos reales dependerán del banco de destino." },
];

const contacts = [
  { icon: MessageCircle, title: "Chat de soporte", sub: "Respuesta en minutos", tone: "bg-tint-green" },
  { icon: Phone, title: "Línea de atención", sub: "Lun a sáb, 7 a. m. a 7 p. m.", tone: "bg-tint-teal" },
];

// Accent- and case-insensitive match for the FAQ search.
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Help() {
  const [query, setQuery] = useState("");
  const list = faqs.filter(({ q, a }) => norm(q + a).includes(norm(query)));

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Ayuda" />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-10">
        <Card tone="mint" className="relative isolate flex flex-col gap-4 overflow-hidden p-5">
          <Blob shape={0} tone="deep" className="-top-16 -right-16 -z-10 size-48 opacity-70" />
          <IconBox tone="solid" size="lg">
            <CircleHelp className="stroke-[2.5]" />
          </IconBox>
          <div className="flex flex-col gap-1">
            <h2 className="text-h2 text-ink">¿En qué te ayudamos?</h2>
            <p className="text-sm font-medium text-green-900">Encuentra respuestas rápidas o escríbenos.</p>
          </div>
          <label htmlFor="faq-search" className="sr-only">Buscar en preguntas frecuentes</label>
          <Input id="faq-search" icon={Search} type="search" placeholder="Busca tu pregunta" value={query} onChange={(e) => setQuery(e.target.value)} className="border-0 shadow-sm" />
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">Preguntas frecuentes</h2>
          <Card tone="soft" className="overflow-hidden">
            {list.map(({ q, a }, i) => (
              <details key={q} className={`group px-4 [&_summary::-webkit-details-marker]:hidden ${i > 0 ? "border-t border-line-soft" : ""}`}>
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink">
                  {q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green-100 text-green-700 transition-[transform,background-color] duration-200 group-open:rotate-45 group-open:bg-green-200">
                    <Plus className="size-[18px] stroke-[2.5]" />
                  </span>
                </summary>
                <p className="pb-4 text-sm font-medium text-ink-2">{a}</p>
              </details>
            ))}
            {list.length === 0 && <p className="p-5 text-center text-sm font-medium text-ink-2">No encontramos preguntas con «{query}». Escríbenos y te ayudamos.</p>}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">Habla con nosotros</h2>
          <div className="grid grid-cols-2 gap-3">
            {contacts.map(({ icon: Icon, title, sub, tone }) => (
              <Link key={title} href="#" className="transition-transform duration-150 active:scale-[0.98]">
                <Card className={`flex h-full flex-col gap-3 p-4 ${tone}`}>
                  <IconBox tone="solid">
                    <Icon />
                  </IconBox>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-ink">{title}</span>
                    <span className="text-[13px] font-medium text-ink-2">{sub}</span>
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
