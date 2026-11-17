"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/flexa/logo";
import { Backdrop } from "@/components/flexa/shapes";
import { AccountForm } from "@/components/flexa/worker/account-form";
import { Building2, Camera, Check, FileText, Hourglass, ShieldCheck } from "@/components/flexa/worker/icons";
import { ErrorState, LoadingCards, Notice } from "@/components/flexa/worker/states";
import type { LegalDoc, Profile } from "@/components/flexa/worker/types";
import { Button, Card, IconBox } from "@/components/flexa/ui";
import { api, ApiError, logout, useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "kyc", label: "Identidad", icon: ShieldCheck },
  { key: "consents", label: "Autorizaciones", icon: FileText },
  { key: "account", label: "Cuenta", icon: Building2 },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// Módulo 1: identity validation, legal consents and destination account, in that order.
export default function Onboarding() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { data: profile, error, loading, reload } = useApi<Profile>("/worker/profile");
  const [picked, setPicked] = useState<StepKey | null>(null);

  if (!profile)
    return (
      <Shell>
        {loading ? <LoadingCards count={2} label="Cargando tu registro" /> : <ErrorState error={error} onRetry={reload} />}
      </Shell>
    );

  const steps = profile.onboarding.steps;
  // A KYC in manual review shouldn't block the other steps; it comes back last.
  const reviewing = profile.kycStatus === "MANUAL_REVIEW";
  const firstOpen = STEPS.find((s) => !steps[s.key] && !(s.key === "kyc" && reviewing))?.key ?? (steps.kyc ? null : "kyc");
  const current = picked && !steps[picked] ? picked : firstOpen;
  const advance = () => {
    setPicked(null);
    reload();
  };

  return (
    <Shell>
      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos del registro">
        {STEPS.map((s, i) => {
          const done = steps[s.key];
          const active = s.key === current;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={done}
                onClick={() => setPicked(s.key)}
                aria-current={active ? "step" : undefined}
                className="flex w-full flex-col gap-2 text-left disabled:cursor-default"
              >
                <span className={cn("h-1.5 rounded-full transition-colors duration-300", done ? "bg-green-600" : active ? "bg-green-300" : "bg-green-100")} />
                <span className={cn("flex items-center gap-1 text-xs font-bold", done ? "text-green-700" : active ? "text-ink" : "text-ink-3")}>
                  {done ? <Check weight="bold" className="size-3.5" /> : <span className="tabular-nums">{i + 1}.</span>}
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current ?? "done"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-4"
        >
          {current === "kyc" && <KycStep profile={profile} onDone={advance} />}
          {current === "consents" && <ConsentStep onDone={advance} />}
          {current === "account" && (
            <Card tone="soft" className="flex flex-col gap-5 p-5">
              <StepHead icon={Building2} title="¿A dónde te enviamos el dinero?" text="Registra la cuenta o billetera donde recibirás tus retiros. Puedes agregar más después." />
              <AccountForm onSaved={advance} submitLabel="Guardar y terminar" />
            </Card>
          )}
          {!current && (
            <Card tone="mint" className="flex flex-col items-center gap-4 px-6 py-10 text-center">
              <IconBox tone="solid" size="xl" halo>
                <Check weight="bold" />
              </IconBox>
              <h2 className="text-h2 text-ink">¡Todo listo, {profile.firstName}!</h2>
              <p className="max-w-[30ch] text-[15px] font-medium text-green-900">Ya puedes ver tu salario devengado y retirar cuando lo necesites.</p>
              <Button className="mt-2 w-full" onClick={() => router.replace("/app")}>
                Ir al inicio
              </Button>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Backdrop variant="inner" />
      <header className="flex h-16 items-center justify-between px-5 pt-2">
        <Logo className="h-7" />
        <button type="button" onClick={() => logout("worker")} className="text-sm font-bold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Salir
        </button>
      </header>
      <main className="flex flex-col gap-5 px-5 pt-2 pb-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink">Completa tu registro</h1>
          <p className="text-[15px] font-medium text-ink-2">Tres pasos y podrás acceder a tu salario.</p>
        </div>
        {children}
      </main>
    </>
  );
}

function StepHead({ icon: Icon, title, text }: { icon: typeof Camera; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <IconBox tone="solid" size="lg">
        <Icon />
      </IconBox>
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-ink">{title}</h2>
        <p className="text-sm font-medium text-ink-2">{text}</p>
      </div>
    </div>
  );
}

type KycResult = { status: "APPROVED" | "MANUAL_REVIEW" | "REJECTED" };

// Simulated selfie capture: a framed "camera" with a scan line, then the sandbox KYC call.
function KycStep({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"intro" | "camera" | "checking">("intro");
  const [status, setStatus] = useState(profile.kycStatus);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    setPhase("checking");
    setError(null);
    try {
      const [r] = await Promise.all([api<KycResult>("/worker/kyc", { method: "POST" }), new Promise((ok) => setTimeout(ok, 1200))]);
      setStatus(r.status);
      setPhase("intro");
      if (r.status === "APPROVED") onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos validar tu identidad.");
      setPhase("camera");
    }
  };

  if (status === "MANUAL_REVIEW")
    return (
      <Card tone="amber" className="flex flex-col gap-4 p-5">
        <StepHead icon={Hourglass} title="Estamos revisando tu identidad" text="Un analista de FLEXA validará tus datos manualmente. Te avisaremos cuando termine; mientras tanto puedes completar los demás pasos." />
        <Button variant="outline" onClick={onDone}>
          Revisar de nuevo
        </Button>
      </Card>
    );

  return (
    <Card tone="soft" className="flex flex-col gap-5 p-5">
      <StepHead
        icon={ShieldCheck}
        title="Valida tu identidad"
        text={`Confirmaremos que eres tú, ${profile.firstName}, con tu documento ${profile.docType} ${profile.docNumber} y una selfie.`}
      />
      {status === "REJECTED" && <Notice tone="error" title="No pudimos validar tu selfie">Busca un lugar con buena luz, sin gafas ni gorra, y vuelve a intentarlo.</Notice>}

      {phase === "intro" ? (
        <>
          <ul className="flex flex-col gap-2 text-sm font-medium text-ink-2">
            <li className="flex gap-2"><Check weight="bold" className="mt-0.5 size-4 shrink-0 text-green-600" />Ubícate en un lugar iluminado.</li>
            <li className="flex gap-2"><Check weight="bold" className="mt-0.5 size-4 shrink-0 text-green-600" />Mira de frente y mantén el rostro dentro del óvalo.</li>
          </ul>
          <Button onClick={() => setPhase("camera")}>
            <Camera />
            Tomar selfie
          </Button>
        </>
      ) : (
        <>
          <div className="relative mx-auto grid aspect-[3/4] w-full max-w-[260px] place-items-center overflow-hidden rounded-xl bg-green-900">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#2f5d3d,#143d22_70%)]" />
            <div aria-hidden className={cn("relative h-[62%] w-[58%] rounded-[50%] border-[3px] border-dashed", phase === "checking" ? "border-green-300" : "border-white/80")} />
            {phase === "checking" && !reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-x-6 h-0.5 rounded-full bg-green-300 shadow-[0_0_12px_2px_rgb(168_214_166/0.8)]"
                initial={{ top: "18%" }}
                animate={{ top: ["18%", "80%", "18%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <span className="absolute bottom-3 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white" role="status">
              {phase === "checking" ? "Analizando tu rostro..." : "Cámara simulada"}
            </span>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button onClick={capture} disabled={phase === "checking"}>
            <Camera />
            {phase === "checking" ? "Validando..." : "Capturar"}
          </Button>
        </>
      )}
    </Card>
  );
}

function ConsentStep({ onDone }: { onDone: () => void }) {
  const { data: docs, error, loading, reload } = useApi<LegalDoc[]>("/worker/legal");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!docs) return loading ? <LoadingCards count={3} label="Cargando documentos" /> : <ErrorState error={error} onRetry={reload} />;

  const pending = docs.filter((d) => !d.acceptedAt);
  const all = pending.every((d) => checked[d.id]);

  const accept = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      for (const d of pending) await api(`/worker/legal/${d.id}/accept`, { method: "POST" });
      onDone();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "No pudimos registrar tu aceptación.");
      setBusy(false);
    }
  };

  return (
    <Card tone="soft" className="flex flex-col gap-5 p-5">
      <StepHead icon={FileText} title="Lee y acepta" text="Estos documentos explican cómo funciona FLEXA y autorizan el descuento por nómina. Léelos antes de aceptar." />
      <div className="flex flex-col gap-3">
        {docs.map((d) => (
          <div key={d.id} className="rounded-md bg-surface p-4 shadow-sm ring-1 ring-black/[0.03]">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-ink">{d.title}</span>
                  <span className="text-xs font-semibold text-ink-3">Versión {d.version}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-green-700 group-open:hidden">Leer</span>
                <span className="hidden shrink-0 text-sm font-bold text-green-700 group-open:inline">Cerrar</span>
              </summary>
              <p className="mt-3 max-h-48 overflow-y-auto border-t border-line-soft pt-3 text-sm leading-relaxed font-medium text-ink-2">{d.body}</p>
            </details>
            {d.acceptedAt ? (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-green-700">
                <Check weight="bold" className="size-4" /> Aceptado
              </p>
            ) : (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={!!checked[d.id]}
                  onChange={(e) => setChecked((c) => ({ ...c, [d.id]: e.target.checked }))}
                  className="mt-0.5 size-5 shrink-0 accent-green-600"
                />
                He leído y acepto este documento
              </label>
            )}
          </div>
        ))}
      </div>
      {saveError && <Notice tone="error">{saveError}</Notice>}
      <Button onClick={pending.length ? accept : onDone} disabled={!all || busy}>
        {busy ? "Guardando..." : "Aceptar y continuar"}
      </Button>
    </Card>
  );
}
