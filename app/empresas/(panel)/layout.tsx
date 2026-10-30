import type { Metadata } from "next";
import { CompanyShell } from "@/components/flexa/company-shell";

export const metadata: Metadata = { title: "Flexa Empresas" };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <CompanyShell>{children}</CompanyShell>;
}
