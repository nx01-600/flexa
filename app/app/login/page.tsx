import Link from "next/link";
import { CircleHelp } from "@/components/flexa/icons";
import { Logo } from "@/components/flexa/logo";
import { LoginForm } from "@/components/flexa/login-form";
import { Backdrop } from "@/components/flexa/shapes";

export default function WorkerLogin() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center overflow-hidden bg-page px-5 text-center">
      <Backdrop variant="login" />
      {/* soft glow that lifts the logo off the page */}
      <div aria-hidden className="pointer-events-none absolute top-[12%] left-1/2 -z-10 h-56 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#e6f2e3,transparent)]" />

      <div className="flex flex-col items-center pt-[22dvh]">
        <Logo className="h-auto w-[190px]" />
        <p className="mt-3 text-[17px] font-semibold text-ink">Tu salario. A tu ritmo.</p>
      </div>

      <div className="mt-10 w-full max-w-[350px] pb-28">
        <LoginForm userLabel="Cédula" userPlaceholder="Cédula (CC/CE)" numeric to="/app" surface="worker" />
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
