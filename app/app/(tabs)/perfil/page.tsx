"use client";

import Link from "next/link";
import { Bell, Building2, ChevronRight, CircleHelp, KeyRound, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";
import { Badge, Card, IconBox } from "@/components/flexa/ui";
import { Switch } from "@/components/ui/switch";
import { worker } from "@/lib/mock";
import { cn } from "@/lib/utils";

const rows = [
  { icon: UserRound, label: "Información personal", href: "#" },
  { icon: Building2, label: "Mi empresa", sub: worker.company, href: "#" },
  { icon: KeyRound, label: "Cambiar contraseña", href: "#" },
  { icon: CircleHelp, label: "Ayuda", href: "/app/ayuda" },
];

// Row body sits right of a 36px icon; the divider starts at the text (16 + 36 + 12 = 64px).
const rowBody = "flex min-h-[60px] flex-1 items-center gap-3 pr-4";

export default function Profile() {
  const [notify, setNotify] = useState(true);

  return (
    <>
      <Backdrop variant="inner" wash />
      <TopBar title="Mi perfil" />
      <main className="flex flex-col gap-6 px-5 pt-3">
        <section className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-[88px] place-items-center rounded-full bg-linear-to-br from-mint-2 to-mint-3 text-green-600 shadow-card ring-[6px] ring-white">
            <UserRound className="size-11" />
          </span>
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-h2 text-ink">{worker.name}</h2>
            <span className="text-sm font-semibold text-ink-2 tabular-nums">{worker.doc}</span>
            <span className="text-sm font-medium text-ink-2">{worker.email}</span>
            <Badge className="mt-2">Cuenta verificada</Badge>
          </div>
        </section>

        <Card tone="soft" className="overflow-hidden">
          {rows.map(({ icon: Icon, label, sub, href }, i) => (
            <Link key={label} href={href} className="group flex items-center gap-3 pl-4 transition-colors hover:bg-green-50/70">
              <IconBox size="sm">
                <Icon />
              </IconBox>
              <span className={cn(rowBody, i > 0 && "border-t border-line-soft")}>
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-bold text-ink">{label}</span>
                  {sub && <span className="text-[13px] font-medium text-ink-3">{sub}</span>}
                </span>
                <ChevronRight aria-hidden className="size-[18px] text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
          <label className="flex cursor-pointer items-center gap-3 pl-4">
            <IconBox size="sm">
              <Bell />
            </IconBox>
            <span className={cn(rowBody, "border-t border-line-soft")}>
              <span className="flex-1 text-[15px] font-bold text-ink">Notificaciones</span>
              <Switch
                checked={notify}
                onCheckedChange={setNotify}
                className="data-[size=default]:h-7 data-[size=default]:w-12 data-checked:bg-green-500 data-unchecked:bg-[#d5e0d3] [&>span]:bg-white [&>span]:shadow-sm [&>span]:group-data-[size=default]/switch:size-6"
              />
            </span>
          </label>
          <Link href="/app/login" className="flex items-center gap-3 pl-4 transition-colors hover:bg-danger-soft/50">
            <IconBox tone="red" size="sm">
              <LogOut />
            </IconBox>
            <span className={cn(rowBody, "border-t border-line-soft text-[15px] font-bold text-danger")}>Cerrar sesión</span>
          </Link>
        </Card>
      </main>
    </>
  );
}
