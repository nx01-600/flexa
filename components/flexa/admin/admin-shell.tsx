"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Building2, FileText, House, IdCard, LogOut, MessageCircle, Receipt, Repeat, ShieldCheck, TriangleAlert, Wifi } from "@/components/flexa/icons";
import { Logo } from "@/components/flexa/logo";
import { Backdrop, Blob } from "@/components/flexa/shapes";
import { logout, type Session } from "@/lib/api";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Resumen", icon: House },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/integraciones", label: "Integraciones", icon: Wifi },
  { href: "/admin/operaciones", label: "Operaciones", icon: Repeat },
  { href: "/admin/incidencias", label: "Incidencias", icon: TriangleAlert },
  { href: "/admin/kyc", label: "Revisión KYC", icon: IdCard },
  { href: "/admin/legal", label: "Documentos legales", icon: FileText },
  { href: "/admin/soporte", label: "Soporte", icon: MessageCircle },
  { href: "/admin/trazabilidad", label: "Trazabilidad", icon: Receipt },
];

// The admin session lives in localStorage; read it without a hydration mismatch.
const SESSION_KEY = "flexa.session.admin";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const readRaw = () => {
  try {
    return localStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
};

function useAdminSession(): Session | null | undefined {
  const raw = useSyncExternalStore<string | undefined>(subscribe, readRaw, () => undefined);
  if (raw === undefined) return undefined; // server render / hydration
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return s.user?.role === "FLEXA_ADMIN" ? s : null;
  } catch {
    return null;
  }
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-md px-2 text-[15px] transition-colors duration-150",
        active ? "bg-green-100 font-bold text-green-900 shadow-xs" : "font-semibold text-ink-2 hover:bg-mint-1 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full transition-colors [&_svg]:size-[18px]",
          active ? "bg-btn-primary text-white shadow-btn" : "bg-mint-2 text-green-700 group-hover:bg-green-200",
        )}
      >
        <Icon />
      </span>
      {label}
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const session = useAdminSession();

  useEffect(() => {
    if (session === null) router.replace("/admin/login");
  }, [session, router]);

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center bg-page" aria-busy="true">
        <span role="status" aria-label="Cargando" className="size-8 animate-spin rounded-full border-[3px] border-green-200 border-t-green-600 motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="relative isolate grid min-h-dvh grid-cols-[248px_minmax(0,1fr)] grid-rows-[68px_1fr] bg-page">
      <Backdrop variant="page" fixed />

      <header className="sticky top-0 z-20 col-span-2 flex items-center justify-between overflow-hidden border-b border-line-soft bg-white/80 px-6 backdrop-blur-md">
        <Blob shape={2} tone="deep" className="-top-16 -left-20 -z-10 h-[150px] w-[340px] opacity-60" />
        <Link href="/admin" aria-label="Resumen" className="flex items-center gap-2.5 rounded-sm">
          <Logo className="h-auto w-[104px]" />
          <span className="text-lg font-semibold text-green-900">Administrador</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex flex-col items-end leading-tight">
            <span className="text-sm font-bold text-ink">{session.user.name}</span>
            <span className="text-xs font-semibold text-ink-3">Equipo FLEXA</span>
          </span>
          <button
            type="button"
            onClick={() => logout("admin")}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-ink-2 shadow-sm transition-colors hover:text-danger [&_svg]:size-[18px]"
          >
            <LogOut />
            Cerrar sesión
          </button>
        </div>
      </header>

      <aside className="sticky top-[68px] flex h-[calc(100dvh-68px)] flex-col gap-1 overflow-y-auto border-r border-line-soft bg-white/70 p-4 backdrop-blur-md">
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.href} {...n} active={n.href === "/admin" ? path === n.href : path.startsWith(n.href)} />
          ))}
        </nav>
        <div className="relative isolate mt-auto overflow-hidden rounded-lg bg-card-mint p-4">
          <Blob shape={0} tone="deep" className="-right-8 -bottom-10 -z-10 size-28 opacity-70" />
          <p className="flex items-center gap-2 text-sm font-bold text-green-900 [&_svg]:size-4">
            <ShieldCheck />
            Rol interno
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-green-800">Supervisas la operación; la nómina la opera cada empresa.</p>
        </div>
      </aside>

      <main className="min-w-0 px-8 pt-7 pb-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
