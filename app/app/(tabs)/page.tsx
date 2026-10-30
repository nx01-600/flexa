import Link from "next/link";
import { ArrowUpRight, ChevronRight, LayoutGrid, Lightbulb } from "lucide-react";
import { Logo } from "@/components/flexa/logo";
import { MovementRow } from "@/components/flexa/movement-row";
import { Card } from "@/components/flexa/ui";
import { money, movements, tips, worker } from "@/lib/mock";

export default function WorkerHome() {
  const withdrawnPct = Math.round((worker.withdrawn / worker.earned) * 100);

  return (
    <main className="flex flex-col gap-6 px-5 pt-4">
      <header className="flex h-12 items-center justify-between">
        <Logo className="h-7" />
        <Link
          href="/app/perfil"
          aria-label="Mi perfil"
          className="grid size-10 place-items-center rounded-full bg-green-200 text-sm font-extrabold text-green-900 transition-transform active:scale-95"
        >
          VT
        </Link>
      </header>

      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink">¡Hola, {worker.firstName}!</h1>
        <p className="text-[15px] text-ink-2">Tu bienestar financiero está en tus manos.</p>
      </section>

      <section aria-label="Saldo" className="overflow-hidden rounded-xl border border-line bg-surface shadow-md">
        <div className="flex flex-col gap-4 bg-green-100 px-5 pt-5 pb-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-green-900/80">Total devengado este mes</span>
            <span className="text-display font-extrabold text-ink tabular-nums">{money(worker.earned)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Retirado ${withdrawnPct} %, disponible ${100 - withdrawnPct} %`}>
              <span className="bg-green-300" style={{ width: `${withdrawnPct}%` }} />
              <span className="bg-green-600" style={{ width: `${100 - withdrawnPct}%` }} />
            </div>
            <div className="flex justify-between text-xs font-semibold text-green-900/80">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-green-300" />Retirado {money(worker.withdrawn)}</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-green-600" />Disponible</span>
            </div>
          </div>
        </div>
        <Link href="/app/retirar" className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-green-50">
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-ink-2">Disponible para retirar</span>
            <span className="text-2xl font-extrabold text-green-600 tabular-nums">{money(worker.available)}</span>
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-green-50 text-green-700 transition-transform duration-200 group-hover:translate-x-0.5">
            <ChevronRight className="size-5" />
          </span>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/app/retirar"
          className="flex h-28 flex-col justify-between rounded-lg bg-green-600 p-4 text-white shadow-md transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="grid size-10 place-items-center rounded-md bg-white/15">
            <ArrowUpRight className="size-5" />
          </span>
          <span className="text-base font-bold">Retirar</span>
        </Link>
        <Link
          href="/app/servicios"
          className="flex h-28 flex-col justify-between rounded-lg border border-line bg-surface p-4 text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="grid size-10 place-items-center rounded-md bg-green-100 text-green-700">
            <LayoutGrid className="size-5" />
          </span>
          <span className="text-base font-bold">Otros servicios</span>
        </Link>
      </section>

      <section className="flex gap-3 rounded-lg bg-warning-soft p-4">
        <Lightbulb className="mt-0.5 size-5 shrink-0 text-warning-icon" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-ink">Consejo del día</span>
          <span className="text-sm text-ink-2">{tips[0]}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-ink">Últimos movimientos</h2>
          <Link href="/app/movimientos" className="text-sm font-semibold text-green-700 hover:underline">
            Ver todos
          </Link>
        </div>
        <Card className="divide-y divide-line overflow-hidden">
          {movements.slice(0, 3).map((m) => (
            <MovementRow key={m.id} m={m} />
          ))}
        </Card>
      </section>
    </main>
  );
}
