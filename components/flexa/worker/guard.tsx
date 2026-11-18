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

// Session user name; "" while server rendering, so hydration matches.
export const useSessionName = () => useSyncExternalStore(subscribe, () => getSession("worker")?.user.name ?? "", () => "");

// Client-side auth gate: the session lives in localStorage, so only the browser knows it.
// While unknown (server render, hydration) the screen renders: data comes from the API with
// the client token, so nothing private is in that HTML, and Next can validate instant
// navigation. Once the browser knows there is no session it hides the screen and redirects.
export function WorkerGuard({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const open = PUBLIC.includes(path.replace(/\/$/, ""));
  const signedIn = useSignedIn();

  useEffect(() => {
    if (!open && signedIn === false) router.replace("/app/login");
  }, [open, signedIn, router]);

  if (open || signedIn !== false) return children;
  return null;
}
