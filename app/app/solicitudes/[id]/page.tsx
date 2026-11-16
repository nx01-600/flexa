import { Suspense } from "react";
import { AdvanceDetail } from "@/components/flexa/worker/advance-detail";

export default function AdvancePage() {
  return (
    <Suspense>
      <AdvanceDetail />
    </Suspense>
  );
}
