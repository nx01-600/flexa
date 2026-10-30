import Link from "next/link";
import { ArrowUpRight, ChevronRight, LayoutGrid, Lightbulb, UserRound } from "lucide-react";
import { MenuButton } from "@/components/flexa/app-shell";
import { Logo } from "@/components/flexa/logo";
import { MovementRow } from "@/components/flexa/movement-row";
import { Backdrop } from "@/components/flexa/shapes";
import { Card, IconBox, SectionTitle } from "@/components/flexa/ui";
import { money, movements, tips, worker } from "@/lib/mock";

export default function WorkerHome() {
  const withdrawnPct = Math.round((worker.withdrawn / worker.earned) * 100);

  return (
    <main className="flex flex-col gap-5 px-5 pt-3">
      <Backdrop variant="home" />
      <header className="grid h-14 grid-cols-[40px_1fr_40px] items-center">
        <MenuButton />
        <Logo className="h-7 justify-self-center" />
        <Link
          href="/app/perfil"
          aria-label="Mi perfil"
          className="grid size-10 place-items-center rounded-full bg-mint-3 text-green-700 shadow-sm ring-4 ring-white/80 transition-transform active:scale-95"
        >
          <UserRound className="size-5 stroke-[2.5]" />
        </Link>
      </header>

      <section className="flex flex-col gap-1 pt-1">
        <h1 className="text-h1 text-ink">¡Hola, {worker.firstName}!</h1>
        <p className="max-w-[24ch] text-[15px] font-medium text-balance text-ink-2">Tu bienestar financiero está en tus manos.</p>
      </section>

      <Card aria-label="Saldo" className="overflow-hidden">
        <div className="flex flex-col gap-4 bg-card-mint px-5 pt-5 pb-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-green-900">Total devengado</span>
            <span className="text-display text-ink tabular-nums">{money(worker.earned)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-white/70" role="img" aria-label={`Has retirado el ${withdrawnPct}% de lo devengado`}>
              <span className="block h-full rounded-full bg-linear-to-r from-green-500 to-green-600" style={{ width: `${withdrawnPct}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-green-900">
              Retirado {money(worker.withdrawn)} · {withdrawnPct}%
            </span>
          </div>
        </div>
        <Link href="/app/retirar" className="group flex items-center justify-between bg-surface px-5 py-4 transition-colors hover:bg-green-50/60">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink-2">Disponible para retirar</span>
            <span className="text-money text-green-600 tabular-nums">{money(worker.available)}</span>
          </span>
          <IconBox tone="white" className="transition-transform duration-200 group-hover:translate-x-0.5">
            <ChevronRight className="stroke-[2.5]" />
          </IconBox>
        </Link>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/app/retirar"
          className="flex h-[118px] flex-col justify-between rounded-lg bg-tile-primary p-4 shadow-tile ring-1 ring-inset ring-white/40 transition-transform duration-150 active:scale-[0.98]"
        >
          <IconBox tone="dark" className="shadow-[0_6px_14px_-6px_rgb(20_61_34/0.6)]">
            <ArrowUpRight className="stroke-[2.5]" />
          </IconBox>
          <span className="text-base font-bold text-green-900">Retirar</span>
        </Link>
        <Link href="/app/servicios" className="transition-transform duration-150 active:scale-[0.98]">
          <Card tone="soft" className="flex h-[118px] flex-col items-center justify-center gap-2 p-4 text-center">
            <IconBox>
              <LayoutGrid />
            </IconBox>
            <span className="text-[15px] leading-tight font-bold text-ink">
              Otros
              <br />
              servicios
            </span>
          </Card>
        </Link>
      </section>

      <Link href="/app/finanzas" className="group">
        <Card tone="soft" className="flex items-center gap-3 p-4">
          <IconBox tone="amber">
            <Lightbulb />
          </IconBox>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold text-ink">Consejo del día</span>
            <span className="text-sm font-medium text-ink-2">{tips[0]}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Card>
      </Link>

      <section className="flex flex-col gap-3 pt-1">
        <SectionTitle
          action={
            <Link href="/app/movimientos" className="text-sm font-bold text-green-700 underline-offset-4 hover:underline">
              Ver todos
            </Link>
          }
        >
          Últimos movimientos
        </SectionTitle>
        <Card tone="soft" className="overflow-hidden">
          {movements.slice(0, 3).map((m, i) => (
            <MovementRow key={m.id} m={m} divider={i > 0} />
          ))}
        </Card>
      </section>
    </main>
  );
}
