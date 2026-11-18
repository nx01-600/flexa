"use client";

import { Menu } from "@base-ui/react/menu";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  ChartColumn,
  ChevronLeft,
  CircleHelp,
  FileSpreadsheet,
  FileText,
  House,
  LogOut,
  Menu as MenuIcon,
  Scale,
  Settings,
  TrendingUp,
  Users,
  X,
} from "@/components/flexa/icons";
import { useEffect, useState, type ReactNode } from "react";
import { roleLabel, useCompanySession, useHydrated } from "@/components/flexa/empresas/kit";
import { LogoEmpresas } from "@/components/flexa/logo";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { dateFmt, logout, useApi } from "@/lib/api";
import { photo } from "@/lib/mock";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/empresas", label: "Inicio", icon: House },
  { href: "/empresas/trabajadores", label: "Trabajadores", icon: Users },
  { href: "/empresas/nomina", label: "Nómina", icon: FileSpreadsheet },
  { href: "/empresas/operaciones", label: "Operaciones", icon: ArrowLeftRight },
  { href: "/empresas/conciliacion", label: "Conciliación", icon: Scale },
  { href: "/empresas/estadisticas", label: "Estadísticas", icon: ChartColumn },
  { href: "/empresas/rendimientos", label: "Rendimientos", icon: TrendingUp },
  { href: "/empresas/trazabilidad", label: "Trazabilidad", icon: FileText },
  { href: "/empresas/configuracion", label: "Configuración", icon: Settings },
];

function NavLink({ href, label, icon: Icon, active, onNavigate }: { href: string; label: string; icon: typeof House; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
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

type Attention = { level: string; title: string; detail: string }[];
type Overview = { period: { label: string; payDate: string } | null };

// Redirects to the login when there is no company session.
function useGuard() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useCompanySession();
  const valid = !!session && ["COMPANY_ADMIN", "COMPANY_FINANCE"].includes(session.user.role);
  useEffect(() => {
    if (hydrated && !valid) router.replace("/empresas/login");
  }, [hydrated, valid, router]);
  return hydrated && valid;
}

function UserMenu() {
  const router = useRouter();
  const session = useCompanySession();
  const name = session?.user.name ?? "";
  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-3 rounded-full bg-surface py-1 pr-1 pl-1 shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-4 focus-visible:ring-green-200/70 sm:pl-4">
        {/* Below sm only the avatar shows; the text stays for screen readers. */}
        <span className="flex flex-col items-end leading-tight max-sm:sr-only">
          <span className="text-sm font-bold text-ink">{name}</span>
          <span className="text-xs font-semibold text-ink-3">{roleLabel[session?.user.role ?? ""] ?? ""}</span>
        </span>
        {name && <Image src={photo(name)} alt="" width={80} height={80} className="size-10 rounded-full object-cover shadow-sm ring-2 ring-white" />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="min-w-56 origin-(--transform-origin) rounded-md bg-surface p-1.5 shadow-lg ring-1 ring-line transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Menu.Item
              onClick={() => router.push("/empresas/configuracion")}
              className="flex h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-[15px] font-semibold text-ink outline-none data-highlighted:bg-green-100 [&_svg]:size-5 [&_svg]:text-green-700"
            >
              <Settings />
              Configuración
            </Menu.Item>
            <Menu.Item
              onClick={() => logout("company")}
              className="flex h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-[15px] font-semibold text-danger outline-none data-highlighted:bg-danger-soft [&_svg]:size-5"
            >
              <LogOut />
              Cerrar sesión
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// Nav + "Próximo pago" card + support link. Rendered in the desktop sidebar and in the mobile sheet.
function SideNav({ path, period, onNavigate }: { path: string; period: Overview["period"] | undefined; onNavigate?: () => void }) {
  return (
    <>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {nav.map((n) => (
          <NavLink key={n.href} {...n} onNavigate={onNavigate} active={n.href === "/empresas" ? path === n.href : path.startsWith(n.href)} />
        ))}
      </nav>
      <div className="flex flex-col gap-3">
        {period && (
          <div className="relative isolate overflow-hidden rounded-lg bg-card-mint p-4">
            <Blob shape={0} tone="deep" className="-right-8 -bottom-10 -z-10 size-28 opacity-70" />
            <p className="text-sm font-bold text-green-900">Próximo pago</p>
            <p className="mt-0.5 text-[13px] font-semibold text-green-800">Nómina del {dateFmt(period.payDate)}</p>
          </div>
        )}
        <NavLink href="/empresas/soporte" label="Soporte" icon={CircleHelp} active={path.startsWith("/empresas/soporte")} onNavigate={onNavigate} />
      </div>
    </>
  );
}

// Hamburger + slide-in drawer with the same nav as the sidebar. Only below lg.
function MobileNav({ path, period }: { path: string; period: Overview["period"] | undefined }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-sm transition-colors hover:text-green-700 lg:hidden [&_svg]:size-5"
      >
        <MenuIcon />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="gap-0 overflow-hidden border-0 bg-page p-0 data-[side=left]:w-[85%] data-[side=left]:max-w-[320px] data-[side=left]:sm:max-w-[320px]"
        >
          <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-line-soft px-4">
            <LogoEmpresas />
            <SheetClose aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm [&_svg]:size-5">
              <X />
            </SheetClose>
          </div>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navega por las secciones de Flexa Empresas</SheetDescription>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-y-auto p-4">
            <SideNav path={path} period={period} onNavigate={close} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Panel({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data: attention } = useApi<Attention>("/analytics/attention");
  const { data: overview } = useApi<Overview>("/analytics/overview");
  const warnings = attention?.filter((a) => a.level !== "INFO").length ?? 0;
  // Below lg the shell is a plain block (sticky header, drawer nav); from lg it is the grid with the fixed sidebar.
  return (
    <div className="relative isolate min-h-dvh bg-page lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:grid-rows-[68px_1fr]">
      <Backdrop variant="page" fixed />

      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between overflow-hidden border-b border-line-soft bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:col-span-2">
        {/* soft shape behind the logo, bleeding into the sidebar corner */}
        <Blob shape={2} tone="deep" className="-top-16 -left-20 -z-10 h-[150px] w-[340px] opacity-60" />
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav path={path} period={overview?.period} />
          <Link href="/empresas" aria-label="Inicio" className="rounded-sm">
            <LogoEmpresas />
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/empresas/operaciones?tab=incidencias"
            aria-label={warnings ? `Avisos, ${warnings} por atender` : "Avisos"}
            className="relative grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm transition-colors hover:text-green-700 [&_svg]:size-5"
          >
            <Bell />
            {warnings > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-danger-500 ring-2 ring-white" />}
          </Link>
          <UserMenu />
        </div>
      </header>

      <aside className="sticky top-[68px] hidden h-[calc(100dvh-68px)] flex-col justify-between gap-4 overflow-y-auto border-r border-line-soft bg-white/70 p-4 backdrop-blur-md lg:flex">
        <SideNav path={path} period={overview?.period} />
      </aside>

      <main className="min-w-0 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-7 lg:pb-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5 lg:gap-6">{children}</div>
      </main>
    </div>
  );
}

export function CompanyShell({ children }: { children: ReactNode }) {
  const ok = useGuard();
  if (!ok) return <div className="min-h-dvh bg-page" aria-busy="true" />;
  return <Panel>{children}</Panel>;
}

export function PageHeader({ title, sub, action, back }: { title: string; sub: string; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div className="flex flex-col gap-1">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex w-fit items-center gap-1 text-[13px] font-bold text-green-700 hover:text-green-900">
            <ChevronLeft className="size-3.5" />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.02em] text-ink lg:text-[28px]">{title}</h1>
        <p className="text-[15px] font-medium text-ink-2">{sub}</p>
      </div>
      {action && <div className="flex flex-wrap items-center gap-3 lg:shrink-0 lg:flex-nowrap">{action}</div>}
    </div>
  );
}
