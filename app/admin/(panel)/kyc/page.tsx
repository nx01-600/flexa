"use client";

import { useState } from "react";
import { Async, ErrorText, Labeled, PageHeader, Status, Textarea, dateTime } from "@/components/flexa/admin/admin-ui";
import { Button, Card } from "@/components/flexa/ui";
import { api, ApiError, useApi } from "@/lib/api";

type Case = {
  id: string;
  firstName: string;
  lastName: string;
  docType: string;
  docNumber: string;
  company: { name: string };
  kycChecks: { id: string; type: string; status: string; score: number | null; provider: string; detail: string | null; createdAt: string }[];
};

const checkType: Record<string, string> = { DOCUMENT: "Documento", SELFIE_BIOMETRIC: "Biometría", ANTIFRAUD: "Antifraude", MANUAL_REVIEW: "Revisión manual" };

function CaseCard({ c, onDone }: { c: Case; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState("");

  async function decide(status: "APPROVED" | "REJECTED") {
    setBusy(status);
    setError("");
    try {
      await api(`/admin/kyc/${c.id}`, { body: { status, note: note.trim() } });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo registrar la decisión.");
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-extrabold text-ink">
            {c.firstName} {c.lastName}
          </h2>
          <p className="text-[13px] font-semibold text-ink-2">
            {c.docType} {c.docNumber} · {c.company.name}
          </p>
        </div>
        <Status value="MANUAL_REVIEW" />
      </div>
      {c.kycChecks.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-md bg-mint-1 p-3 text-[13px]">
          {c.kycChecks.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b className="text-ink">{checkType[k.type] ?? k.type}</b>
              <Status value={k.status} label={k.status === "APPROVED" ? "Aprobado" : k.status === "REJECTED" ? "Rechazado" : undefined} />
              {k.score != null && <span className="font-semibold text-ink-2 tabular-nums">Puntaje {k.score.toFixed(2)}</span>}
              {k.detail && <span className="font-medium text-ink-2">{k.detail}</span>}
              <span className="ml-auto font-medium text-ink-3">{dateTime(k.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <Labeled label="Nota de la decisión (obligatoria)">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué se verificó y con qué soporte" />
      </Labeled>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-3">
        <Button size="sm" variant="danger-outline" disabled={!note.trim() || !!busy} onClick={() => decide("REJECTED")}>
          {busy === "REJECTED" ? "Rechazando…" : "Rechazar"}
        </Button>
        <Button size="sm" disabled={!note.trim() || !!busy} onClick={() => decide("APPROVED")}>
          {busy === "APPROVED" ? "Aprobando…" : "Aprobar identidad"}
        </Button>
      </div>
    </Card>
  );
}

export default function Kyc() {
  const state = useApi<Case[]>("/admin/kyc");
  return (
    <>
      <PageHeader title="Revisión KYC" sub="Validaciones de identidad que el proveedor envió a revisión manual." />
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay casos pendientes de revisión manual.">
        {(rows) => (
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((c) => (
              <CaseCard key={c.id} c={c} onDone={state.reload} />
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
