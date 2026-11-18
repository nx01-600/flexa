import type { Metadata } from "next";
import { Suspense } from "react";
import { CompanyShell } from "@/components/flexa/company-shell";

export const metadata: Metadata = { title: "Flexa Empresas" };

// CompanyShell reads usePathname(); dynamic [id] routes need it inside a Suspense boundary.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-page" aria-busy="true" />}>
      <CompanyShell>{children}</CompanyShell>
    </Suspense>
  );
}
