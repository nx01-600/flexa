"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, IdCard, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input } from "@/components/flexa/ui";

// Prototype login: any input passes, it only navigates. Labels stay for screen
// readers; the visible cue is the placeholder plus a leading icon, as in the mockups.
export function LoginForm({
  userLabel,
  userPlaceholder,
  numeric,
  to,
  size = "lg",
}: {
  userLabel: string;
  userPlaceholder: string;
  numeric?: boolean;
  to: string;
  size?: "lg" | "xl";
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const h = size === "xl" ? "h-14" : "h-13";

  return (
    <form
      className="flex w-full flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => router.push(to), 450);
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
      <Button type="submit" size={size} className="mt-2 w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </Button>
      <Link href="#" className="mt-1 self-center text-sm font-semibold text-green-700 underline underline-offset-4 hover:text-green-900">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
