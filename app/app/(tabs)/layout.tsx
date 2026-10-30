import { BottomNav } from "@/components/flexa/app-shell";

// Bottom padding clears the floating nav (58px + insets) plus breathing room.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-[calc(120px+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </>
  );
}
