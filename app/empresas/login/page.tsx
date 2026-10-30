import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { Logo } from "@/components/flexa/logo";
import { LoginForm } from "@/components/flexa/login-form";

export const metadata: Metadata = { title: "Flexa Empresas" };

export default function CompanyLogin() {
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-green-100 px-14 py-12 lg:flex lg:flex-col lg:justify-between">
        {/* the logo's rays, scaled up as the single brand gesture */}
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-24 -bottom-28 w-[620px] text-green-200" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="14">
          <path d="M100 20v56M30 48l28 40M170 48l-28 40" />
          <path d="M28 196l72-92 72 92" strokeWidth="18" />
        </svg>
        <Logo className="relative h-9 self-start" rays />
        <div className="relative flex max-w-md flex-col gap-4">
          <p className="text-lg font-bold text-green-700">Flexa Empresas</p>
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-[-0.03em] text-ink">Gestión de nómina más simple, más humana.</h1>
        </div>
        <Link href="#" className="relative inline-flex items-center gap-2 self-start text-sm font-semibold text-green-900">
          <CircleHelp className="size-5" />
          ¿Necesitas ayuda?
        </Link>
      </section>

      <section className="flex items-center justify-center bg-[#f7faf6] px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-8">
          <div className="flex flex-col gap-2">
            <Logo className="mb-4 h-9 self-start lg:hidden" />
            <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-ink">Bienvenido</h2>
            <p className="text-[15px] text-ink-2">Ingresa a tu cuenta para continuar.</p>
          </div>
          <LoginForm userLabel="Usuario" userPlaceholder="NIT o correo corporativo" to="/empresas" size="md" />
        </div>
      </section>
    </main>
  );
}
