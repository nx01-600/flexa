import Link from "next/link";
import { ArrowRight, Building2, Smartphone } from "lucide-react";
import { Logo } from "@/components/flexa/logo";

const entries = [
  {
    href: "/app/login",
    icon: Smartphone,
    title: "App del trabajador",
    text: "Versión móvil. Consultar lo devengado, retirar y revisar las finanzas.",
  },
  {
    href: "/empresas/login",
    icon: Building2,
    title: "Flexa Empresas",
    text: "Versión escritorio. Nómina, trabajadores y estadísticas.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-5 py-16">
      <div className="flex flex-col gap-4">
        <Logo className="h-11" />
        <h1 className="max-w-md text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">
          Prototipo visual de Flexa
        </h1>
        <p className="max-w-lg text-base text-ink-2">
          Pantallas navegables con datos de ejemplo. No se mueve dinero ni se guarda información.
        </p>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        {entries.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link href={href} className="group flex items-center gap-4 px-5 py-6 transition-colors hover:bg-green-50 sm:px-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-green-100 text-green-700">
                <Icon className="size-6" />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-lg font-bold text-ink">{title}</span>
                <span className="text-sm text-ink-2">{text}</span>
              </span>
              <ArrowRight className="size-5 text-ink-3 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-green-700" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
