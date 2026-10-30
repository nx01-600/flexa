"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ChartColumn, ChevronLeft, CircleHelp, House, LogOut, Menu, UserRound, X } from "@/components/flexa/icons";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/flexa/logo";
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
      className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 mx-auto max-w-[406px] rounded-xl bg-surface/95 shadow-[0_-8px_24px_rgb(20_61_34/0.08),0_12px_32px_-12px_rgb(20_61_34/0.25)] ring-1 ring-black/[0.03] backdrop-blur"
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

// Round white button used for back / close / menu in headers.
const roundBtn =
  "grid size-10 place-items-center rounded-full bg-surface text-ink shadow-sm ring-1 ring-black/[0.03] transition-transform duration-150 active:scale-95 [&_svg]:size-5 [&_svg]:stroke-[2.5]";

export function TopBar({ title, back = "/app", action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="grid h-16 grid-cols-[40px_1fr_40px] items-center gap-2 px-5 pt-2">
      <Link href={back} aria-label="Volver" className={roundBtn}>
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
  { href: "/app/finanzas", label: "Mis finanzas", icon: ChartColumn },
  { href: "/app/ayuda", label: "Ayuda", icon: CircleHelp },
];

// Hamburger + slide-in drawer (mockup screen 3).
export function MenuButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Abrir menú" onClick={() => setOpen(true)} className={roundBtn}>
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
            <Link href="/app/login" className="flex h-14 items-center gap-3 rounded-md px-3 text-base font-bold text-danger transition-colors hover:bg-danger-soft">
              <IconBox tone="red" size="sm">
                <LogOut />
              </IconBox>
              Cerrar sesión
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
