"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "@/components/flexa/icons";
import { Async, ErrorText, Labeled, PageHeader, Select, Textarea, dateTime } from "@/components/flexa/admin/admin-ui";
import { CardHead } from "@/components/flexa/empresas-ui";
import { Badge, Button, Card, Input } from "@/components/flexa/ui";
import { api, ApiError, useApi } from "@/lib/api";

type Doc = { id: string; type: string; version: string; title: string; body: string; active: boolean; createdAt: string };

const types: Record<string, string> = {
  TERMS: "Términos y condiciones",
  DATA_POLICY: "Política de tratamiento de datos",
  PAYROLL_DEDUCTION_AUTH: "Autorización de descuento de nómina",
};

const blank = { type: "TERMS", version: "", title: "", body: "" };

function Publish({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/legal", { body: f });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo publicar el documento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="soft" className="p-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <CardHead
          title="Publicar nueva versión"
          sub="La versión anterior del mismo tipo se desactiva y los trabajadores deberán aceptarla de nuevo."
          action={
            <button type="button" onClick={onCancel} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-green-100 [&_svg]:size-5">
              <X />
            </button>
          }
        />
        <div className="grid gap-4 md:grid-cols-[1fr_160px_2fr]">
          <Labeled label="Tipo">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.entries(types).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Versión">
            <Input required value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} className="h-11" placeholder="2.0" />
          </Labeled>
          <Labeled label="Título">
            <Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="h-11" />
          </Labeled>
        </div>
        <Labeled label="Texto del documento">
          <Textarea required rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </Labeled>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Publicando…" : "Publicar versión"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function Legal() {
  const state = useApi<Doc[]>("/admin/legal");
  const [publishing, setPublishing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Documentos legales"
        sub="Términos, política de datos y autorización de descuento que aceptan los trabajadores."
        action={
          !publishing && (
            <Button size="md" onClick={() => setPublishing(true)}>
              <Plus />
              Nueva versión
            </Button>
          )
        }
      />
      {publishing && (
        <Publish
          onCancel={() => setPublishing(false)}
          onDone={() => {
            setPublishing(false);
            state.reload();
          }}
        />
      )}
      <Async state={state} isEmpty={(d) => d.length === 0} empty="No hay documentos publicados.">
        {(docs) => (
          <div className="flex flex-col gap-6">
            {Object.entries(types).map(([type, label]) => {
              const list = docs.filter((d) => d.type === type);
              if (!list.length) return null;
              return (
                <Card key={type} className="flex flex-col gap-3 p-6">
                  <CardHead title={label} sub={`${list.length} versión(es)`} />
                  <ul className="flex flex-col divide-y divide-line-soft">
                    {list.map((d) => (
                      <li key={d.id} className="flex flex-col gap-2 py-3">
                        <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id} className="flex items-center gap-3 text-left">
                          <span className="w-16 font-extrabold text-ink tabular-nums">v{d.version}</span>
                          <span className="flex-1 font-semibold text-ink">{d.title}</span>
                          <span className="text-[13px] text-ink-2">{dateTime(d.createdAt)}</span>
                          {d.active ? <Badge>Vigente</Badge> : <Badge tone="gray">Reemplazada</Badge>}
                        </button>
                        {open === d.id && <p className="max-w-[75ch] rounded-md bg-mint-1 px-4 py-3 text-sm font-medium whitespace-pre-line text-ink-2">{d.body}</p>}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </Async>
    </>
  );
}
