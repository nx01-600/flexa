import { BottomNav } from "@/components/flexa/app-shell";

// Below md: content plus the floating bottom nav (bottom padding clears it: 58px + insets
// + breathing room). From md up the side nav and width come from WorkerFrame (app/app/layout.tsx).
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-[calc(120px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <BottomNav />
    </>
  );
}
