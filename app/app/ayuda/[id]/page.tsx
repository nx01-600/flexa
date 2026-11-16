import { Suspense } from "react";
import { TicketDetail } from "@/components/flexa/worker/ticket-detail";

export default function TicketPage() {
  return (
    <Suspense>
      <TicketDetail />
    </Suspense>
  );
}
