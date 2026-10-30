"use client";

import Link from "next/link";
import { Bell, Building2, ChevronRight, CircleHelp, KeyRound, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Card } from "@/components/flexa/ui";
import { Switch } from "@/components/ui/switch";
import { worker } from "@/lib/mock";

const rows = [
  { icon: UserRound, label: "Información personal", href: "#" },
  { icon: Building2, label: "Mi empresa", sub: worker.company, href: "#" },
  { icon: KeyRound, label: "Cambiar contraseña", href: "#" },
  { icon: CircleHelp, label: "Ayuda", href: "/app/ayuda" },
];

export default function Profile() {
  const [notify, setNotify] = useState(true);

  return (
    <>
      <TopBar title="Mi perfil" />
      <main className="flex flex-col gap-5 px-5 pt-2">
        <section className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-green-200 text-2xl font-extrabold text-green-900">VT</span>
          <div className="flex flex-col">
            <h2 className="text-xl font-extrabold text-ink">{worker.name}</h2>
            <span className="text-sm text-ink-2 tabular-nums">{worker.doc}</span>
            <span className="text-sm text-ink-2">{worker.email}</span>
          </div>
        </section>

        <Card className="divide-y divide-line overflow-hidden">
          {rows.map(({ icon: Icon, label, sub, href }) => (
            <Link key={label} href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-green-50">
              <Icon className="size-5 text-ink-2" />
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold text-ink">{label}</span>
                {sub && <span className="text-xs text-ink-3">{sub}</span>}
              </span>
              <ChevronRight className="size-4 text-ink-3" />
            </Link>
          ))}
          <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
            <Bell className="size-5 text-ink-2" />
            <span className="flex-1 text-[15px] font-semibold text-ink">Notificaciones</span>
            <Switch
              checked={notify}
              onCheckedChange={setNotify}
              className="data-[size=default]:h-7 data-[size=default]:w-12 data-checked:bg-green-600 data-unchecked:bg-[#d5e0d3] [&>span]:group-data-[size=default]/switch:size-6 [&>span]:bg-white"
            />
          </label>
        </Card>

        <Link
          href="/app/login"
          className="flex h-13 items-center justify-center gap-2 rounded-md border border-line bg-surface text-[15px] font-bold text-danger transition-colors hover:bg-danger-soft"
        >
          <LogOut className="size-5" />
          Cerrar sesión
        </Link>
      </main>
    </>
  );
}
