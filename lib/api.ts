"use client";

import { useCallback, useEffect, useState } from "react";

// Client for the FLEXA API (backend/). Each surface keeps its own session so a worker
// and a company user can be signed in on the same browser.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type Surface = "worker" | "company" | "admin";

export type Session = {
  accessToken: string;
  user: {
    sub: string;
    role: "WORKER" | "COMPANY_ADMIN" | "COMPANY_FINANCE" | "FLEXA_ADMIN";
    name: string;
    companyId: string | null;
    workerId: string | null;
  };
};

const key = (s: Surface) => `flexa.session.${s}`;

export function getSession(surface: Surface): Session | null {
  try {
    const raw = localStorage.getItem(key(surface));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(surface: Surface, session: Session | null) {
  try {
    if (session) localStorage.setItem(key(surface), JSON.stringify(session));
    else localStorage.removeItem(key(surface));
  } catch {}
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: { message?: string | string[]; errors?: string[]; warnings?: string[]; code?: string } = {},
  ) {
    super(message);
  }
}

// Surface is inferred from the URL so pages don't have to pass it.
export function surfaceFromPath(path = typeof window !== "undefined" ? window.location.pathname : ""): Surface {
  if (path.startsWith("/empresas")) return "company";
  if (path.startsWith("/admin")) return "admin";
  return "worker";
}

const LOGIN_PATH: Record<Surface, string> = { worker: "/app/login", company: "/empresas/login", admin: "/admin/login" };

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData; surface?: Surface; raw?: boolean } = {},
): Promise<T> {
  const surface = opts.surface ?? surfaceFromPath();
  const session = getSession(surface);
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  if (res.status === 401 && session && typeof window !== "undefined") {
    setSession(surface, null);
    window.location.href = LOGIN_PATH[surface];
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(msg ?? "Algo salió mal. Intenta de nuevo.", res.status, body);
  }
  if (opts.raw) return (await res.text()) as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function login(surface: Surface, email: string, password: string) {
  const session = await api<Session>("/auth/login", { body: { email, password, surface }, surface });
  setSession(surface, session);
  return session;
}

export function logout(surface: Surface) {
  setSession(surface, null);
  if (typeof window !== "undefined") window.location.href = LOGIN_PATH[surface];
}

// Downloads a CSV/text endpoint as a file.
export async function download(path: string, filename: string, surface?: Surface) {
  const text = await api<string>(path, { raw: true, surface });
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal data hook: loads on mount and when `path` changes; `reload` refetches.
export function useApi<T>(path: string | null, surface?: Surface) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api<T>(path, { surface })
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof ApiError ? e : new ApiError(String(e), 0)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, surface, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export const money = (n: number | null | undefined) => "$" + Math.round(n ?? 0).toLocaleString("es-CO");

export const dateFmt = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  d ? new Date(d).toLocaleDateString("es-CO", opts) : "—";

export const timeFmt = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "";
