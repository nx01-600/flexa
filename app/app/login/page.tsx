import Link from "next/link";
import { CircleHelp } from "@/components/flexa/icons";
import { Logo } from "@/components/flexa/logo";
import { LoginForm } from "@/components/flexa/login-form";
import { Backdrop } from "@/components/flexa/shapes";

// Below md: the phone login. From md up: full-width canvas (WorkerFrame gives /app/login
// no width cap) with the same card as the company login, centered.
// The wrapper below is `display: contents` on phones, so mobile markup flow is unchanged.
export default function WorkerLogin() {
  return (
    <main data-frame="wide" className="relative isolate flex min-h-dvh flex-col items-center overflow-hidden bg-page px-5 text-center md:justify-center md:py-12">
      {/* Blob gradients share ids across Backdrops, so the first one must stay rendered: opacity, not display:none. */}
      <Backdrop variant="login" className="md:opacity-0" />
      <Backdrop variant="split" className="hidden md:block" />
      {/* soft glow that lifts the logo off the page */}
      <div aria-hidden className="pointer-events-none absolute top-[12%] left-1/2 -z-10 h-56 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#e6f2e3,transparent)] md:hidden" />

      <div className="contents md:flex md:w-full md:max-w-[460px] md:flex-col md:items-center md:rounded-2xl md:bg-card-login md:px-10 md:py-10 md:shadow-raised md:ring-1 md:ring-white/80 md:ring-inset">
        <div className="flex flex-col items-center pt-[22dvh] md:pt-0">
          <Logo className="h-auto w-[190px] md:w-[160px]" />
          <p className="mt-3 text-[17px] font-semibold text-ink">Tu salario. A tu ritmo.</p>
        </div>

        <div className="mt-10 w-full max-w-[350px] pb-28 md:mt-8 md:pb-0">
          <LoginForm userLabel="Cédula" userPlaceholder="Cédula (CC/CE)" numeric to="/app" surface="worker" />
          <p className="mt-6 text-sm font-medium text-ink-2">
            ¿Primera vez en FLEXA?{" "}
            <Link href="/app/registro" className="font-bold text-green-700 underline underline-offset-4 hover:text-green-900">
              Crea tu cuenta
            </Link>
          </p>
          <p className="mt-3 text-sm font-medium text-ink-2">
            ¿Eres empresa?{" "}
            <Link href="/empresas/login" className="font-bold text-green-700 underline underline-offset-4 hover:text-green-900">
              Ingresa aquí
            </Link>
          </p>
        </div>
      </div>

      <Link
        href="/app/ayuda"
        aria-label="¿Necesitas ayuda?"
        className="absolute right-5 bottom-6 grid size-12 place-items-center rounded-full bg-btn-primary text-white shadow-btn transition-transform active:scale-95"
      >
        <CircleHelp className="size-6 stroke-[2.5]" />
      </Link>
    </main>
  );
}
