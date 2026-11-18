"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ChartColumn, ChevronLeft, CircleHelp, House, LayoutGrid, LogOut, Menu, UserRound, Wallet, X } from "@/components/flexa/icons";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/flexa/logo";
import { logout } from "@/lib/api";
import { useSignedIn } from "@/components/flexa/worker/guard";
import { IconBox } from "@/components/flexa/ui";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/app", label: "Inicio", icon: House },
  { href: "/app/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/app/finanzas", label: "Finanzas", icon: ChartColumn },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
];

const isActive = (path: string, href: string) => (href === "/app" ? path === href : path.startsWith(href));

// Floating bottom nav: inset from the edges, rounded, active item in a filled pill.
export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 mx-auto max-w-[406px] rounded-xl bg-surface/95 shadow-[0_-8px_24px_rgb(20_61_34/0.08),0_12px_32px_-12px_rgb(20_61_34/0.25)] ring-1 ring-black/[0.03] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4 p-1.5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[58px] flex-col items-center justify-center gap-1 rounded-lg text-xs transition-colors duration-150",
                  active ? "font-bold text-green-700" : "font-semibold text-ink-2 hover:text-ink",
                )}
              >
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors duration-200", active && "bg-green-100")}>
                  <Icon className={cn("size-[22px]", active && "stroke-[2.5]")} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// md+ replacement for BottomNav: a sticky floating card on the left with the same 4 tabs.
// Compact rail (icon over label) at md, full-width rail (icon beside label) at lg.
// It is a sibling of the content, never a parent, so each screen's Backdrop still anchors
// to the worker root.
export function SideNav() {
  const path = usePathname();
  return (
    <aside className="sticky top-3 m-3 mr-0 hidden h-[calc(100dvh-1.5rem)] w-[88px] shrink-0 flex-col self-start rounded-xl bg-surface/95 p-2 shadow-raised ring-1 ring-black/[0.03] backdrop-blur md:flex lg:w-[232px] lg:p-3">
      <Link href="/app" aria-label="Flexa, inicio" className="mx-auto mt-3 mb-5 lg:mx-0 lg:mt-2 lg:mb-6 lg:px-3">
        <Logo className="h-5 lg:h-7" />
      </Link>
      <nav aria-label="Principal">
        <ul className="flex flex-col gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs transition-colors duration-150 lg:h-14 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:py-0 lg:text-base",
                    active ? "font-bold text-green-700 lg:bg-green-100 lg:text-green-900" : "font-semibold text-ink-2 hover:text-ink lg:hover:bg-green-50",
                  )}
                >
                  <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 lg:h-auto lg:w-auto", active && "bg-green-100 lg:bg-transparent")}>
                    <Icon className={cn("size-[22px]", active && "stroke-[2.5]")} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Drawer-only destinations, so the hamburger can hide from md up. */}
      <nav aria-label="Más" className="mt-4 border-t border-line-soft pt-4">
        <ul className="flex flex-col gap-1">
          {extra.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-center text-[11px] leading-tight transition-colors duration-150 lg:h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:py-0 lg:text-left lg:text-[15px]",
                    active ? "font-bold text-green-700 lg:bg-green-100 lg:text-green-900" : "font-semibold text-ink-2 hover:text-ink lg:hover:bg-green-50",
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={() => logout("worker")}
        className="mt-auto flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-bold text-danger transition-colors hover:bg-danger-soft lg:h-12 lg:flex-row lg:gap-3 lg:rounded-md lg:px-3 lg:py-0 lg:text-[15px]"
      >
        <LogOut className="size-5" />
        Cerrar sesión
      </button>
    </aside>
  );
}

const extra = [
  { href: "/app/salario", label: "Mi salario", icon: Wallet },
  { href: "/app/servicios", label: "Pagos y recargas", icon: LayoutGrid },
  { href: "/app/ayuda", label: "Ayuda", icon: CircleHelp },
];

// Pre-account screens: no side nav. Login gets the full-width canvas, the others a centered column.
const NO_NAV = ["/app/login", "/app/registro", "/app/onboarding"];

// md+ frame for every worker screen, chosen by route. It must not depend on CSS :has() over
// the page tree: Next keeps previously visited routes mounted (hidden) for instant back
// navigation, so a hidden page's markers would still match and break the width.
// Below md every wrapper is `display: contents`, so phones are untouched.
export function WorkerFrame({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/$/, "");
  const signedIn = useSignedIn();
  if (path === "/app/login") return <div className="contents">{children}</div>;
  // null = session not known yet (server/hydration): assume signed in to avoid a layout jump.
  if (NO_NAV.includes(path) || signedIn === false) return <div className="contents md:mx-auto md:block md:max-w-[760px]">{children}</div>;
  return (
    <div className="contents md:mx-auto md:flex md:max-w-[1100px]">
      <SideNav />
      <div className="contents md:block md:min-w-0 md:flex-1 md:px-4 md:pb-10 lg:px-8">{children}</div>
    </div>
  );
}

// Round white button used for back / close / menu in headers.
const roundBtn =
  "grid size-10 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-black/[0.03] transition-transform duration-150 active:scale-95 [&_svg]:size-5 [&_svg]:stroke-[2.5]";

// `tab`: pass on the 4 tab screens, where the side nav replaces the back arrow from md up.
export function TopBar({ title, back = "/app", action, tab }: { title: string; back?: string; action?: ReactNode; tab?: boolean }) {
  return (
    <header className="grid h-16 grid-cols-[40px_1fr_40px] items-center gap-2 px-5 pt-2">
      <Link href={back} aria-label="Volver" className={cn(roundBtn, tab && "md:invisible")}>
        <ChevronLeft />
      </Link>
      <h1 className="text-center text-lg font-extrabold tracking-[-0.01em] text-ink">{title}</h1>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}

const menu = [
  { href: "/app", label: "Inicio", icon: House },
  { href: "/app/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/app/salario", label: "Mi salario", icon: Wallet },
  { href: "/app/finanzas", label: "Mis finanzas", icon: ChartColumn },
  { href: "/app/servicios", label: "Pagos y recargas", icon: LayoutGrid },
  { href: "/app/ayuda", label: "Ayuda", icon: CircleHelp },
];

// Hamburger + slide-in drawer (mockup screen 3).
export function MenuButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* md+ has the side nav with the same destinations. */}
      <button type="button" aria-label="Abrir menú" onClick={() => setOpen(true)} className={cn(roundBtn, "md:hidden")}>
        <Menu />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[82%] max-w-[320px] gap-0 overflow-hidden border-0 bg-page p-0">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-20 -z-0 size-56 rounded-full bg-mint-3/70 blur-2xl" />
          <div className="relative flex items-center justify-between px-5 pt-6 pb-8">
            <Logo className="h-8" />
            <SheetClose aria-label="Cerrar menú" className={roundBtn}>
              <X />
            </SheetClose>
          </div>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navega por las secciones de Flexa</SheetDescription>
          <nav aria-label="Menú" className="relative flex flex-col gap-1 px-3">
            {menu.map(({ href, label, icon: Icon }) => {
              const active = isActive(path, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 items-center gap-3 rounded-md px-3 text-base transition-colors",
                    active ? "bg-green-100 font-bold text-green-900" : "font-semibold text-ink hover:bg-green-50",
                  )}
                >
                  <IconBox tone={active ? "dark" : "green"} size="sm">
                    <Icon />
                  </IconBox>
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto px-3 pb-6">
            <button type="button" onClick={() => logout("worker")} className="flex h-14 w-full items-center gap-3 rounded-md px-3 text-base font-bold text-danger transition-colors hover:bg-danger-soft">
              <IconBox tone="red" size="sm">
                <LogOut />
              </IconBox>
              Cerrar sesión
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
