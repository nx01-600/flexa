"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ChartColumn, ChevronLeft, House, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/app", label: "Inicio", icon: House },
  { href: "/app/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/app/finanzas", label: "Finanzas", icon: ChartColumn },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                  active ? "text-green-700" : "text-ink-3 hover:text-ink",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-200", active && "bg-green-100")}>
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
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

export function TopBar({ title, back = "/app", action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 grid h-14 grid-cols-[44px_1fr_44px] items-center bg-green-50/90 px-3 backdrop-blur">
      <Link href={back} aria-label="Volver" className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-green-100">
        <ChevronLeft className="size-6" />
      </Link>
      <h1 className="text-center text-lg font-bold text-ink">{title}</h1>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}
