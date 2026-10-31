import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { IconWeight } from "@/components/flexa/icons";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flexa",
  description: "Tu salario. A tu ritmo.",
  appleWebApp: { capable: true, title: "Flexa", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fbfdfb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the safe-area insets reach the notch and home bar
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${manrope.variable} h-full`}>
      <body className="min-h-full">
        <IconWeight weight="bold">{children}</IconWeight>
      </body>
    </html>
  );
}
