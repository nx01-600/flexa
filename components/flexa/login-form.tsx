"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, IdCard, LockKeyhole, UserRound } from "@/components/flexa/icons";
import { useState } from "react";
import { login, type Surface } from "@/lib/api";
import { Button, Field, Input } from "@/components/flexa/ui";

// Signs in against the FLEXA API. Labels stay for screen readers; the visible cue
// is the placeholder plus a leading icon, as in the mockups.
export function LoginForm({
  userLabel,
  userPlaceholder,
  numeric,
  to,
  surface,
  size = "lg",
}: {
  userLabel: string;
  userPlaceholder: string;
  numeric?: boolean;
  to: string;
  surface: Surface;
  size?: "lg" | "xl";
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const h = size === "xl" ? "h-14" : "h-13";

  return (
    <form
      className="flex w-full flex-col gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setLoading(true);
        setError(null);
        try {
          await login(surface, String(form.get("user") ?? ""), String(form.get("password") ?? ""));
          router.push(to);
        } catch (err) {
          setError(err instanceof Error ? err.message : "No pudimos iniciar sesión");
          setLoading(false);
        }
      }}
    >
      <Field label={userLabel} htmlFor="user" hideLabel>
        <Input
          id="user"
          name="user"
          icon={numeric ? IdCard : UserRound}
          inputMode={numeric ? "numeric" : "email"}
          autoComplete="username"
          placeholder={userPlaceholder}
          className={h}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password" hideLabel>
        <Input
          id="password"
          name="password"
          icon={LockKeyhole}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Contraseña"
          className={h}
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
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size={size} className="mt-2 w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </Button>
      <Link href="#" className="mt-1 self-center text-sm font-semibold text-green-700 underline underline-offset-4 hover:text-green-900">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
