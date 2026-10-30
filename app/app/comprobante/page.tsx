import { Receipt } from "@/components/flexa/receipt";
import { movements } from "@/lib/mock";

// receipt depends on the query string, so it renders per request
export const instant = false;

export default async function ReceiptPage({ searchParams }: PageProps<"/app/comprobante">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const found = movements.find((m) => m.id === one(q.id));

  const data = found
    ? { amount: found.amount, dest: found.dest, account: found.account, when: `${found.date} · ${found.time}`, ref: `FLEXA-${found.id}`, fresh: false }
    : {
        amount: Number(one(q.monto)) || 100_000,
        dest: one(q.banco) ?? "Bancolombia",
        account: one(q.cuenta) ?? "123 456 7890",
        when: "Hoy · hace un momento",
        ref: "FLEXA-458733",
        fresh: true,
      };

  return <Receipt {...data} />;
}
