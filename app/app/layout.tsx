import type { Metadata } from "next";

export const metadata: Metadata = { title: "Flexa" };

// Worker app: a phone-width column. On wider screens it sits centered so the
// prototype reads as the mobile product it is.
export default function WorkerLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh sm:bg-[#e4ece2]">
      <div className="relative mx-auto min-h-dvh max-w-[430px] bg-green-50 sm:shadow-lg">{children}</div>
    </div>
  );
}
