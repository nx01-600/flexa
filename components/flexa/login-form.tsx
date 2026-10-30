"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button, Field, inputClass } from "@/components/flexa/ui";
import { cn } from "@/lib/utils";

// Prototype login: any input passes, it only navigates.
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
  size?: "lg" | "md";
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const h = size === "md" ? "h-12" : "h-13";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => router.push(to), 450);
      }}
    >
      <Field label={userLabel} htmlFor="user">
        <input
          id="user"
          name="user"
          inputMode={numeric ? "numeric" : "email"}
          autoComplete="username"
          placeholder={userPlaceholder}
          className={cn(inputClass, h)}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            className={cn(inputClass, h, "pr-12")}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-md text-ink-3 hover:text-ink"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size={size} className="mt-2 w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </Button>
      <Link href="#" className="self-center text-sm font-semibold text-green-700 underline-offset-4 hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
