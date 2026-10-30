import { connection } from "next/server";
import { Receipt } from "@/components/flexa/receipt";
import { movements } from "@/lib/mock";

// receipt depends on the query string, so it renders per request
export const instant = false;

export default async function ReceiptPage({ searchParams }: PageProps<"/app/comprobante">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const found = movements.find((m) => m.id === one(q.id));
  // "1234567890" -> "123 456 7890", same grouping as the mock data
  const group = (v: string) => v.replace(/\D/g, "").replace(/^(\d{3})(\d{3})(\d+)$/, "$1 $2 $3");
  // "30 oct 2026 · 5:11 p. m.", same shape as the mock movements
  await connection(); // the clock must be read per request
  const at = new Date();
  const tz = { timeZone: "America/Bogota" } as const;
  const now = `${at.toLocaleDateString("es-CO", { ...tz, day: "numeric" })} ${at.toLocaleDateString("es-CO", { ...tz, month: "short" }).replace(".", "")} ${at.toLocaleDateString("es-CO", { ...tz, year: "numeric" })} · ${at.toLocaleTimeString("es-CO", { ...tz, hour: "numeric", minute: "2-digit" })}`;

  const data = found
    ? { amount: found.amount, dest: found.dest, account: found.account, when: `${found.date} · ${found.time}`, reference: `FLEXA-${found.id}`, fresh: false }
    : {
        amount: Number(one(q.monto)) || 100_000,
        dest: one(q.banco) ?? "Bancolombia",
        account: group(one(q.cuenta) ?? "1234567890"),
        when: now,
        reference: "FLEXA-458733",
        fresh: true,
      };

  return <Receipt {...data} />;
}
