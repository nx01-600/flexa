"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Envelope, Eye, EyeOff, IdCard, LockKeyhole, Phone } from "@/components/flexa/worker/icons";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";
import { Notice } from "@/components/flexa/worker/states";
import { Button, Field, Input } from "@/components/flexa/ui";
import { api, setSession, type Session } from "@/lib/api";

// Módulo 1: only workers already loaded and enabled by their company can register.
export default function Register() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (mismatch) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    try {
      const phone = String(f.get("phone") ?? "").replace(/\D/g, "");
      const session = await api<Session>("/auth/register", {
        surface: "worker",
        body: { docNumber: String(f.get("doc") ?? "").replace(/\D/g, ""), email: String(f.get("email") ?? "").trim(), password, ...(phone ? { phone } : {}) },
      });
      setSession("worker", session);
      router.push("/app/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta.");
      setBusy(false);
    }
  };

  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title="Crear cuenta" back="/app/login" />
      <main className="flex flex-col gap-6 px-5 pt-4 pb-10 md:mx-auto md:max-w-[600px]">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-ink">Activa tu acceso a FLEXA</h2>
          <p className="text-[15px] font-medium text-ink-2">Usa la cédula y el correo que tu empresa registró. Si no te reconocemos, habla con Talento Humano.</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Cédula" htmlFor="doc">
            <Input id="doc" name="doc" icon={IdCard} inputMode="numeric" autoComplete="username" required placeholder="Sin puntos ni espacios" />
          </Field>
          <Field label="Correo electrónico" htmlFor="email">
            <Input id="email" name="email" type="email" icon={Envelope} autoComplete="email" required placeholder="tu@correo.com" />
          </Field>
          <Field label="Celular (opcional)" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" icon={Phone} inputMode="tel" autoComplete="tel" placeholder="300 123 4567" />
          </Field>
          <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres.">
            <Input
              id="password"
              type={show ? "text" : "password"}
              icon={LockKeyhole}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              end={
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="grid size-11 place-items-center rounded-sm text-ink-3 transition-colors hover:text-ink"
                >
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              }
            />
          </Field>
          <Field label="Confirma la contraseña" htmlFor="confirm">
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              icon={LockKeyhole}
              autoComplete="new-password"
              required
              value={confirm}
              aria-invalid={mismatch}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" className="mt-2" disabled={busy}>
            {busy ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
          <p className="text-center text-sm font-medium text-ink-2">
            ¿Ya tienes cuenta?{" "}
            <Link href="/app/login" className="font-bold text-green-700 underline underline-offset-4 hover:text-green-900">
              Inicia sesión
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
