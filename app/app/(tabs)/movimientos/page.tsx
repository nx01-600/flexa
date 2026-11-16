import { Suspense } from "react";
import { MovementsScreen } from "@/components/flexa/worker/movements-screen";

// The active view lives in the query string (?vista=), so the screen renders inside Suspense.
export default function Page() {
  return (
    <Suspense>
      <MovementsScreen />
    </Suspense>
  );
}
