import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkerGuard } from "@/components/flexa/worker/guard";
import { WorkerFrame } from "@/components/flexa/app-shell";

export const metadata: Metadata = { title: "Flexa" };

// Worker app. Below md: a phone-width column (centered with a shadow from sm up).
// From md up the column becomes a full-bleed canvas (bg-page, no shadow) and WorkerFrame
// picks the content width by route: side nav + 1100px for signed-in screens, a 760px
// column for pre-account screens, full width for login. `isolate` lets each screen's
// Backdrop sit behind its content; the Backdrop anchors to this root, so keep the frame non-positioned.
export default function WorkerLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh sm:bg-[#eef3ec]">
      <div className="relative isolate mx-auto min-h-dvh max-w-[430px] overflow-x-clip bg-page sm:shadow-lg md:max-w-none md:shadow-none">
        <Suspense>
          <WorkerGuard>
            <WorkerFrame>{children}</WorkerFrame>
          </WorkerGuard>
        </Suspense>
      </div>
    </div>
  );
}
