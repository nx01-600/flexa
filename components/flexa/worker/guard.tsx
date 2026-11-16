"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getSession } from "@/lib/api";

// Help stays public (the login screen links to it); ticket detail does not.
const PUBLIC = ["/app/login", "/app/registro", "/app/ayuda"];

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

// true / false on the client, null while server rendering.
export const useSignedIn = () => useSyncExternalStore(subscribe, () => !!getSession("worker"), () => null);

// Client-side auth gate: the session lives in localStorage, so the server renders nothing
// for private screens and the browser decides whether to show them or go to the login.
export function WorkerGuard({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const open = PUBLIC.includes(path.replace(/\/$/, ""));
  const signedIn = useSignedIn();

  useEffect(() => {
    if (!open && signedIn === false) router.replace("/app/login");
  }, [open, signedIn, router]);

  if (open || signedIn) return children;
  return null;
}
