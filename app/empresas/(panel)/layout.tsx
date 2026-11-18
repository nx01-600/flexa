import type { Metadata } from "next";
import { CompanyShell } from "@/components/flexa/company-shell";

export const metadata: Metadata = { title: "Flexa Empresas" };

// CompanyShell gates on a localStorage session, so the server renders only a placeholder and
// Next cannot validate instant navigation here. Opt out until auth moves to cookies.
export const instant = false;

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <CompanyShell>{children}</CompanyShell>;
}
