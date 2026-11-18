// Shapes returned by the FLEXA API for the worker surface (backend/src/ewa/worker.controller.ts).

export type OnboardingSteps = { registered: boolean; kyc: boolean; consents: boolean; account: boolean };

export type Profile = {
  id: string;
  docType: string;
  docNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string | null;
  contractType: string | null;
  hireDate: string | null;
  baseSalary: number;
  enabled: boolean;
  status: string;
  kycStatus: "NOT_STARTED" | "APPROVED" | "MANUAL_REVIEW" | "REJECTED" | string;
  company: { name: string; nit: string };
  site: { name: string; city: string } | null;
  onboarding: { steps: OnboardingSteps; complete: boolean };
};

export type AccountType = "SAVINGS" | "CHECKING" | "WALLET";

export type Account = {
  id: string;
  bank: string;
  type: AccountType;
  number: string;
  holder: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: string;
};

export type LegalDoc = { id: string; type: string; version: string; title: string; body: string; acceptedAt: string | null };

export type Earnings = {
  period: { id: string; label: string; startDate: string; endDate: string; payDate: string } | null;
  baseSalary: number;
  periodSalary: number;
  workedDays: number;
  periodDays: number;
  grossEarned: number;
  netEarned: number;
  used: number;
  advancedAmount: number;
  paymentsAmount: number;
  available: number;
  recommended: number;
  projectedNet: number;
  nextPayAfterUsage: number;
  usagePct: number;
  limits: {
    maxAdvancePct: number;
    recommendedPct: number;
    limitAmount: number;
    minAmount: number;
    maxAmountPerRequest: number;
    maxRequestsPerPeriod: number;
    requestsUsed: number;
    feePerRequest: number;
    blackoutDaysBeforePay: number;
  };
  canRequest: boolean;
  blockers: string[];
  dataUpdatedAt: string;
};

export type Explanation = { steps: { label: string; value: number; detail: string }[]; note: string };

export type Simulation = {
  amount: number;
  fee: number;
  youReceive: number;
  toDiscountFromPayroll: number;
  available: number;
  recommended: number;
  overRecommended: boolean;
  nextPayBefore: number;
  nextPayAfter: number;
  payDate: string | null;
  usagePctAfter: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiresAcknowledgement: boolean;
};

export type AdvanceStatus = "REQUESTED" | "APPROVED" | "EXCEPTION" | "DISBURSED" | "FAILED" | "REJECTED" | "CANCELLED" | string;

export type AdvanceEvent = { id: string; status: AdvanceStatus; note: string | null; createdAt: string };

export type Advance = {
  id: string;
  code: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: AdvanceStatus;
  overRecommended: boolean;
  exceptionReason: string | null;
  disbursedAt: string | null;
  createdAt: string;
  bankAccount: { bank: string; number: string; type?: AccountType };
  period: { label: string; payDate?: string };
  events?: AdvanceEvent[];
};

export type MovementKind = "retiro" | "pago" | "recarga";

export type Movement = {
  id: string;
  code: string;
  kind: MovementKind;
  title: string;
  amount: number;
  dest: string;
  account: string;
  status: string;
  date: string;
};

export type ReceiptData = {
  kind: "RETIRO" | "PAGO" | "RECARGA";
  code: string;
  status: string;
  date: string;
  amount: number;
  fee: number;
  received: number;
  destination: string;
  worker?: string;
  doc?: string;
  company?: string;
  providerRef?: string;
  category?: string;
  note?: string;
};

export type Wellness = {
  recommended: number;
  available: number;
  used: number;
  usagePct: number;
  overRecommended: boolean;
  nextPayAfterUsage: number;
  projectedNet: number;
  alarmThresholds: { usagePct: number; requests: number };
  byPeriod: { period: string; startDate: string; total: number; count: number }[];
  tips: string[];
};

export type Alert = { id: string; type: string; level: "INFO" | "WARNING" | "CRITICAL" | string; title: string; message: string; read: boolean; createdAt: string };

export type WorkerDocument = { id: string; type: "RECEIPT" | "CONSENT" | string; title: string; refId: string | null; createdAt: string };

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "CLOSED";

export type Ticket = {
  id: string;
  code: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  advanceId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  messages?: { id: string; body: string; createdAt: string; author: { name: string; role: string } }[];
  advance?: { code: string; amount: number; status: AdvanceStatus } | null;
};

// ---------- labels ----------

export const accountTypeLabel: Record<AccountType, string> = { SAVINGS: "Ahorros", CHECKING: "Corriente", WALLET: "Billetera digital" };

type Tone = "green" | "amber" | "gray" | "red" | "teal";

export const advanceStatus: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Solicitado", tone: "teal" },
  APPROVED: { label: "Aprobado", tone: "teal" },
  DISBURSING: { label: "Desembolsando", tone: "teal" },
  EXCEPTION: { label: "En revisión", tone: "amber" },
  DISBURSED: { label: "Desembolsado", tone: "green" },
  COMPLETED: { label: "Pagado", tone: "green" },
  FAILED: { label: "Fallido", tone: "red" },
  REJECTED: { label: "Rechazado", tone: "red" },
  CANCELLED: { label: "Cancelado", tone: "gray" },
};

export const statusOf = (s: string) => advanceStatus[s] ?? { label: s, tone: "gray" as Tone };

export const ticketStatus: Record<TicketStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Abierto", tone: "teal" },
  IN_PROGRESS: { label: "En gestión", tone: "amber" },
  WAITING_USER: { label: "Te respondimos", tone: "green" },
  CLOSED: { label: "Cerrado", tone: "gray" },
};

export const CANCELLABLE = ["REQUESTED", "EXCEPTION"];

// "8 nov 2026 · 6:43 p. m."
export const stamp = (d: string | null | undefined) =>
  d
    ? `${new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(".", "")} · ${new Date(d).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`
    : "—";
