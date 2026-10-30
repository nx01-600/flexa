import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { Logo } from "@/components/flexa/logo";
import { LoginForm } from "@/components/flexa/login-form";

export default function WorkerLogin() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-5">
      {/* brand rays, enlarged from the logo, as the only decoration */}
      <svg aria-hidden viewBox="0 0 200 120" className="pointer-events-none absolute -top-6 left-1/2 w-[520px] -translate-x-1/2 text-green-200" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="10">
        <path d="M100 8v40M38 26l20 30M162 26l-20 30" />
      </svg>

      <div className="relative flex flex-1 flex-col justify-center gap-3 pt-24 pb-10">
        <Logo className="h-14 self-start" />
        <p className="text-xl font-bold text-ink">Tu salario. A tu ritmo.</p>
      </div>

      <div className="relative pb-6">
        <LoginForm userLabel="Cédula" userPlaceholder="Número de cédula (CC o CE)" numeric to="/app" />
      </div>

      <Link
        href="/app/ayuda"
        className="relative mb-6 inline-flex items-center gap-2 self-center rounded-full px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-green-100"
      >
        <CircleHelp className="size-5 text-green-600" />
        ¿Necesitas ayuda?
      </Link>
    </main>
  );
}
