"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Receipt } from "@/components/flexa/receipt";
import { ScreenFrame } from "@/components/flexa/worker/screen-frame";
import { ErrorState, LoadingCards } from "@/components/flexa/worker/states";
import type { ReceiptData } from "@/components/flexa/worker/types";
import { useApi } from "@/lib/api";

export function ReceiptScreen() {
  const { code } = useParams<{ code: string }>();
  const fresh = useSearchParams().get("nuevo") === "1";
  const { data, error, loading, reload } = useApi<ReceiptData>(`/worker/receipts/${encodeURIComponent(code)}`);

  if (data) return <Receipt data={data} fresh={fresh} />;
  return (
    <ScreenFrame title="Comprobante" back="/app/movimientos">
      {loading ? <LoadingCards count={2} label="Cargando comprobante" /> : <ErrorState error={error} onRetry={reload} title="No encontramos este comprobante" />}
    </ScreenFrame>
  );
}
