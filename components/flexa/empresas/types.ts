// Shapes returned by the FLEXA API for the company panel (only the fields the UI reads).

export type Period = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: "OPEN" | "CLOSED" | "COMPENSATED" | "RECONCILED";
  budget: number | null;
  closedAt: string | null;
  _count?: { entries: number; advances: number; uploads: number };
  reconciliation?: { status: string } | null;
};

export type Site = { id: string; name: string; city: string; _count?: { workers: number } };

export type Settings = {
  maxAdvancePct: number;
  recommendedPct: number;
  minAmount: number;
  maxAmountPerRequest: number;
  maxRequestsPerPeriod: number;
  feePerRequest: number;
  blackoutDaysBeforePay: number;
  alarmUsagePct: number;
  alarmRequestsCount: number;
  exceptionAmount: number;
  payFrequency: "BIWEEKLY" | "MONTHLY";
};

export type Worker = {
  id: string;
  docType: string;
  docNumber: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  contractType: string | null;
  hireDate: string | null;
  baseSalary: number;
  enabled: boolean;
  status: string;
  kycStatus: string;
  disabledReason: string | null;
  siteId: string | null;
  site: { name: string; city: string } | null;
  withdrawnPeriod: number;
  advancesPeriod: number;
};

export type Advance = {
  id: string;
  code: string;
  workerId: string;
  periodId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  availableAtRequest: number;
  recommendedAtRequest: number;
  overRecommended: boolean;
  warningAcknowledged: boolean;
  exceptionReason: string | null;
  providerRef: string | null;
  fundingRef: string | null;
  disbursedAt: string | null;
  createdAt: string;
  worker?: { firstName: string; lastName: string; docNumber: string; site?: { name: string } | null };
  bankAccount?: { bank: string; number?: string; type?: string } | null;
  period?: { label: string; payDate?: string };
};

export type AuditEntry = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  data: unknown;
  createdAt: string;
  actorId: string | null;
  actor?: { name: string; role: string } | null;
};

export type Incident = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  workerId: string | null;
  advanceId: string | null;
  worker: { firstName: string; lastName: string; docNumber: string } | null;
  advance: { code: string; amount: number; status: string } | null;
};

export type Novelty = {
  id: string;
  type: string;
  description: string;
  days: number;
  amount: number;
  date: string;
  worker: { firstName: string; lastName: string; docNumber: string };
  period: { label: string } | null;
};

export type Upload = {
  id: string;
  source: string;
  fileName: string;
  status: string;
  totalRows: number;
  okRows: number;
  createdAt: string;
  period: { label: string };
  periodId: string;
  _count?: { issues: number };
  issues?: { id: string; row: number; docNumber: string | null; field: string; message: string; severity: string; resolved: boolean }[];
};

export type CompLine = {
  id: string;
  periodId: string;
  workerId: string;
  advancesCount: number;
  advancedTotal: number;
  feesTotal: number;
  toCompensate: number;
  compensatedAmount: number;
  difference: number;
  status: string;
  note: string | null;
  worker: { firstName: string; lastName: string; docNumber: string; site?: { name: string } | null };
  period?: { label: string };
};

export type Reconciliation = {
  id: string;
  periodId: string;
  status: string;
  disbursedTotal: number;
  compensatedTotal: number;
  differenceTotal: number;
  closedAt: string | null;
  updatedAt: string;
  period?: { label: string; startDate: string; payDate: string };
};

export type Ticket = {
  id: string;
  code: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: { name: string; role: string; email?: string };
  _count?: { messages: number };
  messages?: { id: string; body: string; createdAt: string; author: { name: string; role: string } }[];
  advance?: { code: string; amount: number; status: string } | null;
};
