import { Suspense } from "react";
import { FinancesScreen } from "@/components/flexa/worker/finances-screen";

// The active view lives in the query string (?vista=), so the screen renders inside Suspense.
export default function Page() {
  return (
    <Suspense>
      <FinancesScreen />
    </Suspense>
  );
}
