import { Suspense } from "react";
import { ProfileScreen } from "@/components/flexa/worker/profile-screen";

// The active view lives in the query string (?vista=), so the screen renders inside Suspense.
export default function Page() {
  return (
    <Suspense>
      <ProfileScreen />
    </Suspense>
  );
}
