"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChartColumn, CircleHelp, FileSpreadsheet, House, Scale, Settings, UserRound, Users } from "@/components/flexa/icons";
import type { ReactNode } from "react";
import { LogoEmpresas } from "@/components/flexa/logo";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { company } from "@/lib/mock";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/empresas", label: "Inicio", icon: House },
  { href: "/empresas/nomina", label: "Nómina", icon: FileSpreadsheet },
  { href: "/empresas/estadisticas", label: "Estadísticas", icon: ChartColumn },
  { href: "/empresas/rendimientos", label: "Rendimientos", icon: Scale },
  { href: "/empresas/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/empresas/configuracion", label: "Configuración", icon: Settings },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-12 items-center gap-3 rounded-md px-2 text-[15px] transition-colors duration-150",
        active ? "bg-green-100 font-bold text-green-900 shadow-xs" : "font-semibold text-ink-2 hover:bg-mint-1 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full transition-colors [&_svg]:size-5",
          active ? "bg-btn-primary text-white shadow-btn [&_svg]:stroke-[2.5]" : "bg-mint-2 text-green-700 group-hover:bg-green-200",
        )}
      >
        <Icon />
      </span>
      {label}
    </Link>
  );
}

export function CompanyShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="relative isolate grid min-h-dvh grid-cols-[248px_minmax(0,1fr)] grid-rows-[68px_1fr] bg-page">
      <Backdrop variant="page" fixed />

      <header className="sticky top-0 z-20 col-span-2 flex items-center justify-between overflow-hidden border-b border-line-soft bg-white/80 px-6 backdrop-blur-md">
        {/* soft shape behind the logo, bleeding into the sidebar corner */}
        <Blob shape={2} tone="deep" className="-top-16 -left-20 -z-10 h-[150px] w-[340px] opacity-60" />
        <Link href="/empresas" aria-label="Inicio" className="rounded-sm">
          <LogoEmpresas />
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notificaciones, 3 nuevas"
            className="relative grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm transition-colors hover:text-green-700 [&_svg]:size-5"
          >
            <Bell />
            <span className="absolute top-2 right-2.5 size-2 rounded-full bg-danger-500 ring-2 ring-white" />
          </button>
          <Link
            href="/empresas/configuracion"
            className="flex items-center gap-3 rounded-full bg-surface py-1 pr-1 pl-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex flex-col items-end leading-tight">
              <span className="text-sm font-bold text-ink">{company.name}</span>
              <span className="text-xs font-semibold text-ink-3">Administrador</span>
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-btn-primary text-white shadow-btn [&_svg]:size-5 [&_svg]:stroke-[2.5]">
              <UserRound />
            </span>
          </Link>
        </div>
      </header>

      <aside className="sticky top-[68px] flex h-[calc(100dvh-68px)] flex-col justify-between border-r border-line-soft bg-white/70 p-4 backdrop-blur-md">
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.href} {...n} active={n.href === "/empresas" ? path === n.href : path.startsWith(n.href)} />
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          <div className="relative isolate overflow-hidden rounded-lg bg-card-mint p-4">
            <Blob shape={0} tone="deep" className="-right-8 -bottom-10 -z-10 size-28 opacity-70" />
            <p className="text-sm font-bold text-green-900">Próximo corte</p>
            <p className="mt-0.5 text-[13px] font-semibold text-green-800">Nómina del 15 nov 2026</p>
          </div>
          <a href="#" className="flex h-12 items-center gap-3 rounded-md px-2 text-[15px] font-semibold text-ink-2 transition-colors hover:bg-mint-1 hover:text-ink">
            <span className="grid size-9 place-items-center rounded-full bg-mint-2 text-green-700 [&_svg]:size-5">
              <CircleHelp />
            </span>
            Ayuda
          </a>
        </div>
      </aside>

      <main className="min-w-0 px-8 pt-7 pb-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="text-[15px] font-medium text-ink-2">{sub}</p>
      </div>
      {action}
    </div>
  );
}
