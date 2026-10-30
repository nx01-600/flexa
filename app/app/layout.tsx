import type { Metadata } from "next";

export const metadata: Metadata = { title: "Flexa" };

// Worker app: a phone-width column. On wider screens it sits centered so the
// prototype reads as the mobile product it is. `isolate` lets each screen's
// Backdrop sit behind its content.
export default function WorkerLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh sm:bg-[#eef3ec]">
      <div className="relative isolate mx-auto min-h-dvh max-w-[430px] overflow-x-clip bg-page sm:shadow-lg">{children}</div>
    </div>
  );
}
