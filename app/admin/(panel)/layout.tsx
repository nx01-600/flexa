import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/flexa/admin/admin-shell";

export const metadata: Metadata = { title: "Administrador FLEXA" };

// The shell reads the pathname and a client-side session, so it streams in behind Suspense.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-page" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
