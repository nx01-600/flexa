import { Suspense } from "react";
import { ReceiptScreen } from "@/components/flexa/worker/receipt-screen";

// The receipt code comes from the URL, so it renders inside Suspense.
export default function ReceiptPage() {
  return (
    <Suspense>
      <ReceiptScreen />
    </Suspense>
  );
}
