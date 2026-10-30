"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChartColumn, CircleHelp, FileSpreadsheet, House, Settings, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import { LogoEmpresas } from "@/components/flexa/logo";
import { company } from "@/lib/mock";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/empresas", label: "Inicio", icon: House },
  { href: "/empresas/nomina", label: "Nómina", icon: FileSpreadsheet },
  { href: "/empresas/estadisticas", label: "Estadísticas", icon: ChartColumn },
  { href: "/empresas/rendimientos", label: "Rendimientos", icon: TrendingUp },
  { href: "/empresas/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/empresas/configuracion", label: "Configuración", icon: Settings },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
        active ? "bg-green-100 text-green-900" : "text-ink-2 hover:bg-green-50 hover:text-ink",
      )}
    >
      <Icon className={cn("size-5", active ? "text-green-700" : "text-ink-3")} strokeWidth={active ? 2.25 : 1.75} />
      {label}
    </Link>
  );
}

export function CompanyShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="grid min-h-dvh grid-cols-[240px_1fr] grid-rows-[64px_1fr] bg-[#f7faf6]">
      <header className="col-span-2 flex items-center justify-between border-b border-line bg-green-100/60 px-6">
        <Link href="/empresas" aria-label="Inicio">
          <LogoEmpresas />
        </Link>
        <Link href="/empresas/configuracion" className="flex items-center gap-3 rounded-full py-1 pr-1 pl-3 transition-colors hover:bg-green-100">
          <Building2 className="size-5 text-ink-2" />
          <span className="text-sm font-bold text-ink">{company.name}</span>
          <span className="grid size-9 place-items-center rounded-full bg-green-600 text-xs font-extrabold text-white">ES</span>
        </Link>
      </header>
      <aside className="sticky top-0 flex h-[calc(100dvh-64px)] flex-col justify-between border-r border-line bg-surface p-4">
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.href} {...n} active={n.href === "/empresas" ? path === n.href : path.startsWith(n.href)} />
          ))}
        </nav>
        <NavLink href="#" label="Ayuda" icon={CircleHelp} active={false} />
      </aside>
      <main className="min-w-0 px-8 py-7">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="text-sm text-ink-2">{sub}</p>
      </div>
      {action}
    </div>
  );
}
