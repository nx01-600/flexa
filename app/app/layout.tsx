import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkerGuard } from "@/components/flexa/worker/guard";

export const metadata: Metadata = { title: "Flexa" };

// The session lives in localStorage, so WorkerGuard renders nothing on the server and
// Next cannot validate instant navigation for these segments. Opt out until auth moves to cookies.
export const instant = false;

// Worker app. Below md: a phone-width column (centered with a shadow from sm up).
// From md up the column becomes a full-bleed canvas (bg-page, no shadow) and the
// inner frame below sets the content width. `isolate` lets each screen's Backdrop sit
// behind its content; the Backdrop anchors to this root, so keep the frame non-positioned.
//
// md+ frame contract (the frame is `display: contents` below md, so phones are untouched):
//   default                    760px centered column (back-header screens: retirar, salario, ...)
//   [data-frame="rail"] inside 1100px, for screens with the side nav (set by (tabs)/layout)
//   [data-frame="wide"] inside full width, for hero screens such as login
export default function WorkerLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh sm:bg-[#eef3ec]">
      <div className="relative isolate mx-auto min-h-dvh max-w-[430px] overflow-x-clip bg-page sm:shadow-lg md:max-w-none md:shadow-none">
        <Suspense>
          <WorkerGuard>
            <div className="contents md:mx-auto md:block md:max-w-[760px] md:has-[[data-frame=rail]]:max-w-[1100px] md:has-[[data-frame=wide]]:max-w-none">
              {children}
            </div>
          </WorkerGuard>
        </Suspense>
      </div>
    </div>
  );
}
