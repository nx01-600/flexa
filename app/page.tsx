import Link from "next/link";
import { ArrowRight, Building2, Smartphone } from "@/components/flexa/icons";
import { Logo } from "@/components/flexa/logo";
import { Backdrop } from "@/components/flexa/shapes";
import { IconBox } from "@/components/flexa/ui";

// Miniature phone drawn with plain boxes: balance card, two tiles, a list.
function PhonePreview() {
  return (
    <div className="flex h-40 w-[92px] flex-col gap-1.5 rounded-[18px] bg-surface p-2 shadow-card ring-4 ring-white/60">
      <div className="h-1.5 w-8 rounded-full bg-line" />
      <div className="flex h-11 flex-col justify-end gap-1 rounded-[10px] bg-card-mint p-1.5">
        <div className="h-1 w-6 rounded-full bg-green-600/40" />
        <div className="h-2 w-12 rounded-full bg-green-700" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-9 rounded-[8px] bg-tile-primary" />
        <div className="h-9 rounded-[8px] bg-surface shadow-sm ring-1 ring-line-soft" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="size-3 rounded-full bg-danger-soft" />
          <span className="h-1 flex-1 rounded-full bg-line" />
        </div>
      ))}
    </div>
  );
}

// Miniature dashboard: sidebar, KPI strip and a bar chart.
function DesktopPreview() {
  return (
    <div className="flex h-36 w-[230px] gap-2 rounded-[14px] bg-surface p-2 shadow-card ring-4 ring-white/60">
      <div className="flex w-10 flex-col gap-1.5 pt-1">
        <div className="h-2.5 rounded-[5px] bg-green-200" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 rounded-full bg-line" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5">
          {["bg-tint-green", "bg-tint-teal", "bg-tint-amber"].map((t) => (
            <div key={t} className={`h-7 rounded-[6px] shadow-xs ring-1 ring-line-soft ${t}`} />
          ))}
        </div>
        <div className="flex flex-1 items-end gap-1.5 rounded-[8px] px-1.5 pb-1.5 ring-1 ring-line-soft">
          {[55, 80, 70, 95, 62].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-[3px] bg-gradient-to-b from-[#8fd08f] to-[#5dae64]" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const entries = [
  {
    href: "/app/login",
    icon: Smartphone,
    title: "App del trabajador",
    text: "Versión móvil. Consulta lo devengado, retira y revisa tus finanzas.",
    preview: <PhonePreview />,
  },
  {
    href: "/empresas/login",
    icon: Building2,
    title: "Flexa Empresas",
    text: "Versión escritorio. Nómina, trabajadores y estadísticas.",
    preview: <DesktopPreview />,
  },
];

export default function Home() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-page">
      <Backdrop variant="page" />
      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-12 px-5 py-16 text-center">
        <div className="flex flex-col items-center gap-5">
          <Logo className="h-auto w-[170px]" />
          <h1 className="text-display text-balance text-ink sm:text-[40px]">Prototipo visual de Flexa</h1>
          <p className="max-w-md text-base font-medium text-ink-2">Pantallas navegables con datos de ejemplo. No se mueve dinero ni se guarda información.</p>
        </div>

        <ul className="grid w-full gap-5 sm:grid-cols-2">
          {entries.map(({ href, icon: Icon, title, text, preview }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full flex-col overflow-hidden rounded-xl bg-surface bg-card-soft text-left shadow-card ring-1 ring-white/70 ring-inset transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-raised"
              >
                <div className="relative isolate grid h-52 place-items-center overflow-hidden bg-card-mint">
                  <div aria-hidden className="absolute -right-10 -bottom-16 -z-10 size-48 rounded-full bg-white/40" />
                  {preview}
                </div>
                <div className="flex flex-1 items-start gap-4 p-6">
                  <IconBox size="lg">
                    <Icon />
                  </IconBox>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-xl font-extrabold tracking-[-0.02em] text-ink">{title}</span>
                    <span className="text-[15px] font-medium text-ink-2">{text}</span>
                  </div>
                  <span className="grid size-11 shrink-0 place-items-center self-center rounded-full bg-btn-primary text-white shadow-btn transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight className="size-5 stroke-[2.5]" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
