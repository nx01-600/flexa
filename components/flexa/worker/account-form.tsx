"use client";

import { useState } from "react";
import { Building2 } from "@/components/flexa/icons";
import { Choice } from "@/components/flexa/choice";
import { Notice } from "@/components/flexa/worker/states";
import { accountTypeLabel, type Account, type AccountType } from "@/components/flexa/worker/types";
import { Button, Field, Input } from "@/components/flexa/ui";
import { api, ApiError } from "@/lib/api";

export const BANKS = ["Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Banco de Occidente", "Banco Popular", "Scotiabank Colpatria", "Nequi", "Daviplata"];
const WALLETS = ["Nequi", "Daviplata"];
const TYPES = Object.entries(accountTypeLabel) as [AccountType, string][];

// Registers a destination account (POST /worker/accounts). Wallet banks force the wallet type.
export function AccountForm({ onSaved, submitLabel = "Guardar cuenta", makeDefault }: { onSaved: (a: Account) => void; submitLabel?: string; makeDefault?: boolean }) {
  const [bank, setBank] = useState<string | null>(null);
  const [type, setType] = useState<AccountType | null>(null);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = number.replace(/\D/g, "");
  const effectiveType = bank && WALLETS.includes(bank) ? "WALLET" : type;
  const valid = !!bank && !!effectiveType && digits.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const a = await api<Account>("/worker/accounts", { body: { bank, type: effectiveType, number: number.trim(), ...(makeDefault ? { isDefault: true } : {}) } });
      onSaved(a);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar la cuenta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Banco o billetera" htmlFor="acc-bank">
        <Choice id="acc-bank" options={BANKS} value={bank} onChange={setBank} placeholder="Selecciona tu banco" icon={Building2} className="data-[size=default]:h-13" />
      </Field>
      {bank && WALLETS.includes(bank) ? null : (
        <Field label="Tipo de cuenta" htmlFor="acc-type">
          <Choice
            id="acc-type"
            options={TYPES.map(([, l]) => l)}
            value={type ? accountTypeLabel[type] : null}
            onChange={(l) => setType(TYPES.find(([, x]) => x === l)?.[0] ?? null)}
            className="data-[size=default]:h-13"
          />
        </Field>
      )}
      <Field label={bank && WALLETS.includes(bank) ? "Número de celular" : "Número de cuenta"} htmlFor="acc-number" hint="Debe estar a tu nombre.">
        <Input id="acc-number" inputMode="numeric" autoComplete="off" placeholder="Solo números" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, "").slice(0, 20))} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={!valid || busy}>
        {busy ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
