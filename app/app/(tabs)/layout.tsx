import { BottomNav } from "@/components/flexa/app-shell";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <BottomNav />
    </>
  );
}
