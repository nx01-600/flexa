import { BottomNav, SideNav } from "@/components/flexa/app-shell";

// Below md: content plus the floating bottom nav (bottom padding clears it: 58px + insets
// + breathing room). From md up: side nav on the left and the content column on the right,
// inside the 1100px "rail" frame (see app/app/layout.tsx). The content column is
// ~600px wide at 768, ~660px at 1024 and ~760px at 1100+, after its own padding, so
// single-column screens already fit; 2-column grids go inside each screen's <main>.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-frame="rail" className="md:flex">
      <SideNav />
      <div className="pb-[calc(120px+env(safe-area-inset-bottom))] md:min-w-0 md:flex-1 md:px-4 md:pb-10 lg:px-8">{children}</div>
      <BottomNav />
    </div>
  );
}
