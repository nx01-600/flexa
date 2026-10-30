import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp } from "@/components/flexa/icons";
import { Logo } from "@/components/flexa/logo";
import { LoginForm } from "@/components/flexa/login-form";
import { Backdrop } from "@/components/flexa/shapes";

export const metadata: Metadata = { title: "Flexa Empresas" };

export default function CompanyLogin() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-page">
      <Backdrop variant="split" />

      <div className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-16 px-6 py-14 lg:grid-cols-2">
        {/* brand side */}
        <section className="hidden flex-col items-center text-center lg:flex">
          <Logo className="h-auto w-[300px]" />
          <p className="mt-2 text-[36px] leading-tight font-semibold tracking-[-0.02em] text-green-900">Empresas</p>
          <p className="mt-8 text-[22px] leading-snug font-medium text-ink-2">
            Gestión de nómina
            <br />
            más simple, más humana.
          </p>
        </section>

        {/* login card */}
        <section className="flex justify-center">
          <div className="flex w-full max-w-[460px] flex-col items-center rounded-2xl bg-card-login px-8 py-10 text-center shadow-raised ring-1 ring-white/80 ring-inset sm:px-10">
            <Logo className="h-auto w-[150px]" />
            <p className="mt-1 text-xl font-semibold text-green-900">Empresas</p>
            <h1 className="mt-7 text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ink">Bienvenido</h1>
            <p className="mt-1.5 mb-7 text-[15px] font-medium text-ink-2">Ingresa a tu cuenta para continuar.</p>
            <LoginForm userLabel="Usuario" userPlaceholder="Usuario (NIT o correo corporativo)" to="/empresas" size="xl" />
          </div>
        </section>
      </div>

      <Link href="#" className="mb-8 ml-8 inline-flex items-center gap-2.5 self-start text-sm font-semibold text-green-900 hover:text-green-700">
        <span className="grid size-8 place-items-center rounded-full bg-green-500 text-white shadow-xs">
          <CircleHelp className="size-5 stroke-[2.5]" />
        </span>
        ¿Necesitas ayuda?
      </Link>
    </main>
  );
}
