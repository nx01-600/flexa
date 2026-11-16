"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Receipt as ReceiptIcon } from "@/components/flexa/icons";
import { ScreenFrame } from "@/components/flexa/worker/screen-frame";
import { ErrorState, LoadingCards, Notice } from "@/components/flexa/worker/states";
import { Timeline } from "@/components/flexa/worker/timeline";
import { accountTypeLabel, CANCELLABLE, stamp, statusOf, type Advance } from "@/components/flexa/worker/types";
import { Badge, Button, ButtonLink, Card } from "@/components/flexa/ui";
import { api, ApiError, money, useApi } from "@/lib/api";

export function AdvanceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: a, error, loading, reload, setData } = useApi<Advance>(`/worker/advances/${encodeURIComponent(id)}`);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/worker/advances/${id}/cancel`, { method: "POST" });
      setData(await api<Advance>(`/worker/advances/${id}`));
      setConfirming(false);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "No pudimos cancelar la solicitud.");
    } finally {
      setBusy(false);
    }
  };

  if (!a)
    return (
      <ScreenFrame title="Solicitud" back="/app/movimientos?vista=solicitudes">
        {loading ? <LoadingCards count={2} label="Cargando solicitud" /> : <ErrorState error={error} onRetry={reload} title="No encontramos esta solicitud" />}
      </ScreenFrame>
    );

  const st = statusOf(a.status);
  const rows: [string, string][] = [
    ["Código", a.code],
    ["Cuenta destino", `${a.bankAccount.bank} ${a.bankAccount.number}${a.bankAccount.type ? ` · ${accountTypeLabel[a.bankAccount.type]}` : ""}`],
    ["Comisión", a.fee ? money(a.fee) : "Sin costo"],
    ["Periodo", a.period.label],
    ["Solicitado", stamp(a.createdAt)],
  ];

  return (
    <ScreenFrame title="Solicitud" back="/app/movimientos?vista=solicitudes">
      <Card tone="mint" className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="text-sm font-semibold text-green-900">Monto solicitado</span>
        <span className="text-display text-ink tabular-nums">{money(a.amount)}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </Card>

      {a.status === "EXCEPTION" && a.exceptionReason && <Notice tone="warning" title="Tu empresa la está revisando">{a.exceptionReason}</Notice>}
      {a.overRecommended && <Notice tone="info">Este retiro superó el monto recomendado en su momento.</Notice>}

      <Card tone="soft" className="flex flex-col gap-4 p-5">
        <h2 className="text-h3 text-ink">Estado</h2>
        <Timeline events={a.events ?? []} status={a.status} />
      </Card>

      <Card tone="soft" className="px-5 py-2">
        <dl className="flex flex-col">
          {rows.map(([k, v], i) => (
            <div key={k} className={`flex min-h-12 items-center justify-between gap-4 py-2 ${i > 0 ? "border-t border-line-soft" : ""}`}>
              <dt className="shrink-0 text-sm font-medium text-ink-2">{k}</dt>
              <dd className="text-right text-sm font-bold text-ink tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {a.status === "DISBURSED" && (
        <ButtonLink href={`/app/comprobante/${a.code}`} variant="soft">
          <ReceiptIcon />
          Ver comprobante
        </ButtonLink>
      )}

      {CANCELLABLE.includes(a.status) && (
        <div className="flex flex-col gap-2">
          {actionError && <Notice tone="error">{actionError}</Notice>}
          {confirming ? (
            <Card tone="red" className="flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold text-ink">¿Cancelar esta solicitud de {money(a.amount)}? No se te desembolsará el dinero.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="md" onClick={() => setConfirming(false)} disabled={busy}>
                  No, mantener
                </Button>
                <Button variant="danger" size="md" onClick={cancel} disabled={busy}>
                  {busy ? "Cancelando..." : "Sí, cancelar"}
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger-outline" onClick={() => setConfirming(true)}>
              Cancelar solicitud
            </Button>
          )}
        </div>
      )}
    </ScreenFrame>
  );
}
