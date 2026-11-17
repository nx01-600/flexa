import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Deterministic pseudo-random so the seed is reproducible.
let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));
const round = (n: number, step = 10_000) => Math.round(n / step) * step;

const PASSWORD = 'Flexa2026!';
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const BANKS = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Nequi', 'Daviplata'];
const FIRST = ['Andrés', 'Sofía', 'Mateo', 'Isabella', 'Santiago', 'Mariana', 'Sebastián', 'Daniela', 'Nicolás', 'Gabriela', 'Julián', 'Natalia', 'Tomás', 'Juliana', 'Alejandro', 'Paula', 'Esteban', 'Carolina', 'David', 'Luisa', 'Miguel', 'Manuela', 'Samuel', 'Antonia', 'Felipe', 'Lucía', 'Simón', 'Sara', 'Emilio', 'Valeria'];
const LAST = ['García', 'Rodríguez', 'Martínez', 'Hernández', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flórez', 'Rivera', 'Gómez', 'Díaz', 'Moreno', 'Muñoz', 'Rojas', 'Vargas', 'Castro', 'Ortiz', 'Ospina', 'Cardona', 'Mejía', 'Restrepo', 'Valencia'];
const POSITIONS = ['Auxiliar de bodega', 'Operario de producción', 'Asesor comercial', 'Auxiliar administrativo', 'Conductor', 'Cajero', 'Analista', 'Supervisor de turno', 'Técnico de mantenimiento'];

// The seed TRUNCATEs every table: only run it against a local database (or with an explicit override).
function assertSafeTarget() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed: NODE_ENV=production');
  if (process.env.ALLOW_SEED === '1') return;
  let host = '';
  try {
    host = new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {}
  if (!['localhost', '127.0.0.1', 'postgres'].includes(host)) {
    throw new Error(`Refusing to seed: DATABASE_URL host "${host}" is not local. Set ALLOW_SEED=1 to override.`);
  }
}

async function main() {
  assertSafeTarget();
  console.log('Limpiando datos…');
  await prisma.$executeRawUnsafe(`
    TRUNCATE "AuditLog","TicketMessage","SupportTicket","Document","Incident","Reconciliation","CompensationLine",
    "Alert","ServicePayment","AdvanceEvent","Advance","PayrollNovelty","PayrollIssue","PayrollEntry","PayrollUpload",
    "PayrollPeriod","BankAccount","Consent","LegalDocument","KycCheck","Worker","Site","CompanySettings","User","Company" CASCADE`);

  const hash = await bcrypt.hash(PASSWORD, 10);

  // ---------- Legal documents ----------
  const legal = await Promise.all(
    [
      { type: 'TERMS', title: 'Términos y condiciones de FLEXA', body: 'FLEXA te permite acceder anticipadamente a una parte del salario que ya devengaste. El acceso anticipado no es un crédito: es salario ya ganado que se descuenta en tu siguiente pago de nómina. La simulación no garantiza un desembolso; solo al confirmar se crea una solicitud, que debe estar dentro de tu disponible.' },
      { type: 'DATA_POLICY', title: 'Política de tratamiento de datos personales', body: 'Autorizas a FLEXA y a tu empleador a tratar tus datos personales, laborales y financieros con la finalidad de calcular tu salario devengado, validar tu identidad y realizar desembolsos, conforme a la Ley 1581 de 2012.' },
      { type: 'PAYROLL_DEDUCTION_AUTH', title: 'Autorización de descuento por nómina', body: 'Autorizo a mi empleador a descontar de mi siguiente pago de nómina los valores que reciba anticipadamente a través de FLEXA, junto con las comisiones informadas antes de cada solicitud.' },
    ].map((d) => prisma.legalDocument.create({ data: { ...d, version: '1.0' } })),
  );

  // ---------- FLEXA admin ----------
  await prisma.user.create({ data: { email: 'admin@flexa.co', name: 'Operaciones FLEXA', role: 'FLEXA_ADMIN', passwordHash: hash } });

  // ---------- Client company ----------
  const company = await prisma.company.create({
    data: {
      name: 'Empresa S.A.',
      nit: '900.123.456-7',
      pricePerWorker: 9900,
      integrationType: 'ERP_API',
      erpName: 'SIESA',
      apiKey: 'flx_demo_empresa_sa',
      settings: { create: { maxAdvancePct: 50, recommendedPct: 25, minAmount: 20_000, maxAmountPerRequest: 1_000_000, maxRequestsPerPeriod: 4, feePerRequest: 0, blackoutDaysBeforePay: 2, alarmUsagePct: 70, alarmRequestsCount: 3, exceptionAmount: 800_000 } },
      users: {
        create: [
          { name: 'Ricardo Salazar', email: 'gerencia@empresa.com', role: 'COMPANY_ADMIN', passwordHash: hash },
          { name: 'Paola Muñoz', email: 'rrhh@empresa.com', role: 'COMPANY_ADMIN', passwordHash: hash },
          { name: 'Jorge Valencia', email: 'finanzas@empresa.com', role: 'COMPANY_FINANCE', passwordHash: hash },
        ],
      },
    },
  });
  const hr = await prisma.user.findUniqueOrThrow({ where: { email: 'rrhh@empresa.com' } });

  // Second, smaller client still onboarding (shows the FLEXA admin view).
  await prisma.company.create({
    data: {
      name: 'Logística del Pacífico S.A.S.',
      nit: '901.555.210-3',
      status: 'ONBOARDING',
      integrationStatus: 'NOT_CONFIGURED',
      integrationType: 'FILE',
      settings: { create: {} },
      users: { create: { name: 'Diana Ríos', email: 'talento@logpacifico.com', role: 'COMPANY_ADMIN', passwordHash: hash } },
    },
  });

  const siteDefs = [
    ['Sede Cali', 'Cali'],
    ['Sede Bogotá', 'Bogotá'],
    ['Sede Medellín', 'Medellín'],
    ['Sede Barranquilla', 'Barranquilla'],
    ['Sede Bucaramanga', 'Bucaramanga'],
  ];
  const sites = await Promise.all(siteDefs.map(([name, city]) => prisma.site.create({ data: { name, city, companyId: company.id } })));
  const siteBy = (city: string) => sites.find((x) => x.city === city)!;

  // ---------- Workers ----------
  type W = { first: string; last: string; doc: string; city: string; salary: number; enabled?: boolean; email?: string; registered?: boolean; position?: string };
  const named: W[] = [
    { first: 'Valentina', last: 'Torres', doc: '1234567890', city: 'Cali', salary: 2_000_000, email: 'valentina.torres@email.com', registered: true, position: 'Analista de cartera' },
    { first: 'Juan', last: 'Pérez', doc: '1107233481', city: 'Cali', salary: 2_400_000, registered: true },
    { first: 'María', last: 'López', doc: '1144902115', city: 'Bogotá', salary: 2_100_000, registered: true },
    { first: 'Carlos', last: 'Gómez', doc: '94551208', city: 'Cali', salary: 1_900_000, registered: true },
    { first: 'Ana', last: 'Castaño', doc: '1020778640', city: 'Medellín', salary: 1_750_000, registered: true },
    { first: 'Diego', last: 'Rentería', doc: '1130665902', city: 'Cali', salary: 1_600_000, enabled: false },
    { first: 'Laura', last: 'Torres', doc: '1006112874', city: 'Barranquilla', salary: 1_450_000, registered: true },
    { first: 'Andrés', last: 'Ruiz', doc: '80224517', city: 'Bogotá', salary: 2_800_000, registered: true },
    { first: 'Camila', last: 'Díaz', doc: '1098441330', city: 'Bucaramanga', salary: 1_500_000, registered: true },
    { first: 'Felipe', last: 'Mora', doc: '1144087226', city: 'Medellín', salary: 1_300_000, enabled: false },
  ];
  const cities = ['Cali', 'Cali', 'Cali', 'Bogotá', 'Bogotá', 'Medellín', 'Medellín', 'Barranquilla', 'Bucaramanga'];
  for (let i = 0; i < 36; i++) {
    named.push({
      first: pick(FIRST),
      last: `${pick(LAST)} ${pick(LAST)}`,
      doc: String(1_000_000_000 + between(1, 150_000_000)),
      city: pick(cities),
      salary: round(between(1_423_500, 4_200_000), 50_000),
      registered: rnd() > 0.25,
      enabled: rnd() > 0.08,
    });
  }
  // One worker pending manual KYC review (document ending in 000).
  named.push({ first: 'Héctor', last: 'Quintero', doc: '1112223000', city: 'Cali', salary: 1_600_000, registered: true });

  const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '.');
  const workers = [];
  for (const w of named) {
    const email = w.email ?? `${slug(w.first)}.${slug(w.last.split(' ')[0])}${w.doc.slice(-3)}@empresa.com`;
    const enabled = w.enabled ?? true;
    const registered = enabled && !!w.registered;
    const pendingKyc = w.doc.endsWith('000');
    const user = registered
      ? await prisma.user.create({ data: { email, name: `${w.first} ${w.last}`, role: 'WORKER', companyId: company.id, passwordHash: hash } })
      : null;
    const worker = await prisma.worker.create({
      data: {
        companyId: company.id,
        userId: user?.id,
        siteId: siteBy(w.city).id,
        docNumber: w.doc,
        firstName: w.first,
        lastName: w.last,
        email,
        phone: `3${between(100000000, 209999999)}`,
        position: w.position ?? pick(POSITIONS),
        hireDate: new Date(2026 - between(0, 6), between(0, 11), between(1, 28)),
        baseSalary: w.salary,
        enabled,
        status: !enabled ? 'DISABLED' : !registered ? 'INVITED' : pendingKyc ? 'PENDING_KYC' : 'ACTIVE',
        kycStatus: !registered ? 'NOT_STARTED' : pendingKyc ? 'MANUAL_REVIEW' : 'APPROVED',
        disabledReason: enabled ? null : 'Periodo de prueba',
      },
    });
    if (registered) {
      await prisma.kycCheck.createMany({
        data: ['DOCUMENT', 'SELFIE_BIOMETRIC', 'ANTIFRAUD'].map((type) => ({ workerId: worker.id, type, status: pendingKyc ? 'MANUAL_REVIEW' : 'APPROVED', score: type === 'SELFIE_BIOMETRIC' ? 0.94 : null, providerRef: `KYC-SEED${worker.docNumber.slice(-4)}` })),
      });
      if (!pendingKyc) {
        await prisma.consent.createMany({ data: legal.map((d) => ({ workerId: worker.id, documentId: d.id })) });
        const bank = w.first === 'Valentina' ? 'Bancolombia' : pick(BANKS);
        await prisma.bankAccount.create({
          data: { workerId: worker.id, bank, type: ['Nequi', 'Daviplata'].includes(bank) ? 'WALLET' : 'SAVINGS', number: ['Nequi', 'Daviplata'].includes(bank) ? `300${between(1000000, 9999999)}` : `${between(100, 999)} ${between(100000, 999999)} ${between(10, 99)}`, holder: `${w.first} ${w.last}`, isDefault: true, verified: true },
        });
        if (w.first === 'Valentina')
          await prisma.bankAccount.create({ data: { workerId: worker.id, bank: 'Nequi', type: 'WALLET', number: '300 123 4567', holder: 'Valentina Torres', verified: true } });
      }
    }
    workers.push(worker);
  }
  const active = await prisma.worker.findMany({ where: { companyId: company.id, status: 'ACTIVE' }, include: { accounts: true } });
  const valentina = active.find((w) => w.firstName === 'Valentina')!;

  // ---------- Payroll periods: Jun–Oct 2026 closed, Nov 2026 open ----------
  const today = new Date();
  const months = [5, 6, 7, 8, 9, 10]; // Jun..Nov (0-based)
  let advCounter = 458000;
  for (const m of months) {
    const start = new Date(2026, m, 1);
    const end = new Date(2026, m + 1, 0);
    const isOpen = m === 10;
    const isLastClosed = m === 9;
    const label = `${MONTHS[m]} 2026`;
    const enabledWorkers = workers.filter((w) => w.enabled);
    const projectedBase = enabledWorkers.reduce((a, w) => a + w.baseSalary, 0);
    const period = await prisma.payrollPeriod.create({
      data: {
        companyId: company.id,
        label,
        startDate: start,
        endDate: end,
        payDate: end,
        status: isOpen ? 'OPEN' : isLastClosed ? 'CLOSED' : 'RECONCILED',
        budget: BigInt(round(projectedBase * 1.08, 1_000_000)),
        closedAt: isOpen ? null : new Date(2026, m + 1, 1),
      },
    });

    // Payroll upload for the period (Jul came with issues).
    const upload = await prisma.payrollUpload.create({
      data: {
        companyId: company.id,
        periodId: period.id,
        source: m === 6 ? 'FILE' : 'ERP_API',
        fileName: m === 6 ? `Nomina_${label.replace(' ', '')}.csv` : `SIESA ${label}`,
        status: m === 6 ? 'WITH_ISSUES' : 'PROCESSED',
        totalRows: enabledWorkers.length + (m === 6 ? 2 : 0),
        okRows: enabledWorkers.length,
        uploadedBy: hr.id,
        createdAt: isOpen ? new Date(today.getTime() - 86_400_000) : new Date(2026, m, 15),
      },
    });
    if (m === 6)
      await prisma.payrollIssue.createMany({
        data: [
          { uploadId: upload.id, row: 14, docNumber: '1144555999', field: 'documento', message: 'El trabajador no está registrado en FLEXA', resolved: true, resolvedAt: new Date(2026, 6, 16) },
          { uploadId: upload.id, row: 27, docNumber: '1006112874', field: 'dias_trabajados', message: 'Supera los 31 días del periodo', resolved: true, resolvedAt: new Date(2026, 6, 16) },
        ],
      });

    const dayOfMonth = isOpen ? today.getDate() : end.getDate();
    for (const w of enabledWorkers) {
      const overtime = rnd() < 0.35 ? between(2, 18) + (m >= 8 ? between(0, 6) : 0) : 0;
      const hourly = w.baseSalary / 220;
      await prisma.payrollEntry.create({
        data: {
          periodId: period.id,
          workerId: w.id,
          uploadId: upload.id,
          baseSalary: w.baseSalary,
          workedDays: Math.min(dayOfMonth, 30),
          overtimeHours: overtime,
          overtimeAmount: Math.round(overtime * hourly * 1.25),
          surcharges: rnd() < 0.25 ? round(between(40_000, 220_000), 1000) : 0,
          deductions: rnd() < 0.1 ? round(between(50_000, 200_000), 1000) : 0,
          netPay: isOpen ? null : Math.round(w.baseSalary * 0.92),
        },
      });
    }

    // Advances: usage grows month by month.
    const users = active.filter(() => rnd() < 0.45 + (m - 5) * 0.06);
    if (!users.includes(valentina)) users.push(valentina);
    const lines = new Map<string, number>();
    for (const w of users) {
      const n = w === valentina ? (isOpen ? 2 : between(1, 2)) : between(1, 3);
      for (let k = 0; k < n; k++) {
        const maxDay = isOpen ? Math.max(1, today.getDate() - 1) : end.getDate() - 3;
        const day = Math.max(1, Math.min(maxDay, Math.round(((k + 1) / (n + 1)) * maxDay) + between(-2, 2)));
        const created = new Date(2026, m, day, between(7, 20), between(0, 59));
        const amount = w === valentina ? (isOpen ? [60_000, 40_000][k] : 100_000) : round(between(50_000, Math.min(450_000, w.baseSalary * 0.22)));
        const account = w.accounts.find((a) => a.isDefault) ?? w.accounts[0];
        const failed = isOpen && k === 0 && rnd() < 0.03;
        const advance = await prisma.advance.create({
          data: {
            code: `FX-${++advCounter}`,
            workerId: w.id,
            periodId: period.id,
            bankAccountId: account.id,
            amount,
            netAmount: amount,
            status: failed ? 'FAILED' : 'DISBURSED',
            availableAtRequest: round(w.baseSalary * 0.25),
            recommendedAtRequest: round(w.baseSalary * 0.12),
            overRecommended: amount > w.baseSalary * 0.12,
            providerRef: failed ? null : `PAY-S${advCounter}`,
            fundingRef: `FND-S${advCounter}`,
            disbursedAt: failed ? null : new Date(created.getTime() + 90_000),
            createdAt: created,
          },
        });
        await prisma.advanceEvent.createMany({
          data: [
            { advanceId: advance.id, status: 'REQUESTED', actor: w.userId, createdAt: created },
            { advanceId: advance.id, status: 'APPROVED', note: 'Cumple las reglas: aprobación automática', createdAt: created },
            { advanceId: advance.id, status: failed ? 'FAILED' : 'DISBURSED', note: failed ? 'La entidad destino rechazó la transferencia' : `Transferencia PAY-S${advCounter}`, createdAt: new Date(created.getTime() + 90_000) },
          ],
        });
        if (failed)
          await prisma.incident.create({ data: { companyId: company.id, workerId: w.id, advanceId: advance.id, category: 'DISBURSEMENT_FAILED', title: `Falló el desembolso ${advance.code}`, description: 'La entidad destino rechazó la transferencia' } });
        else {
          lines.set(w.id, (lines.get(w.id) ?? 0) + amount);
          await prisma.document.create({ data: { workerId: w.id, type: 'RECEIPT', title: `Comprobante ${advance.code}`, refId: advance.id, createdAt: created } });
        }
      }
      // Some bill payments from the available balance.
      if ((rnd() < 0.3 || w === valentina) && !(isOpen && w === valentina)) {
        const [category, biller, kind] = pick([
          ['Servicios públicos', 'EPM', 'PAGO'],
          ['Servicios públicos', 'Emcali', 'PAGO'],
          ['Telefonía', 'Claro', 'RECARGA'],
          ['Internet', 'Claro hogar', 'PAGO'],
          ['Telefonía', 'Movistar', 'RECARGA'],
        ] as const);
        const amount = round(between(30_000, 120_000), 5_000);
        const p = await prisma.servicePayment.create({
          data: { code: `SP-${++advCounter}`, workerId: w.id, periodId: period.id, kind, category, biller, reference: `Ref. ${between(1000, 9999)} ${between(1000, 9999)}`, amount, createdAt: new Date(2026, m, Math.min(dayOfMonth, between(3, 25)), between(8, 21)) },
        });
        lines.set(w.id, (lines.get(w.id) ?? 0) + amount);
        await prisma.document.create({ data: { workerId: w.id, type: 'RECEIPT', title: `Comprobante ${p.code}`, refId: p.id, createdAt: p.createdAt } });
      }
    }

    // Compensation and reconciliation for closed periods.
    if (!isOpen) {
      let total = 0;
      let comp = 0;
      for (const [workerId, value] of lines) {
        const count = await prisma.advance.count({ where: { periodId: period.id, workerId, status: 'DISBURSED' } });
        // October still has two differences to resolve.
        const compensated = isLastClosed && comp < 2 && rnd() < 0.2 ? value - round(between(20_000, 80_000)) : value;
        if (compensated !== value) comp++;
        total += value;
        await prisma.compensationLine.create({
          data: { periodId: period.id, workerId, advancesCount: count, advancedTotal: value, feesTotal: 0, toCompensate: value, compensatedAmount: isLastClosed ? compensated : value, difference: value - (isLastClosed ? compensated : value), status: isLastClosed && compensated !== value ? 'PARTIAL' : 'APPLIED' },
        });
      }
      const compensatedTotal = (await prisma.compensationLine.aggregate({ where: { periodId: period.id }, _sum: { compensatedAmount: true } }))._sum.compensatedAmount ?? 0;
      await prisma.reconciliation.create({
        data: {
          companyId: company.id,
          periodId: period.id,
          status: isLastClosed ? (total !== compensatedTotal ? 'WITH_DIFFERENCES' : 'IN_PROGRESS') : 'RECONCILED',
          disbursedTotal: total,
          compensatedTotal,
          differenceTotal: total - compensatedTotal,
          closedAt: isLastClosed ? null : new Date(2026, m + 1, 5),
          closedBy: isLastClosed ? null : hr.id,
        },
      });
      if (isLastClosed && total !== compensatedTotal)
        await prisma.incident.create({ data: { companyId: company.id, category: 'RECONCILIATION', title: `Diferencias en la conciliación de ${label}`, description: `Diferencia total $${(total - compensatedTotal).toLocaleString('es-CO')}` } });
    }
  }

  // Current period: novelties, an exception pending review and Valentina's alerts.
  const nov = await prisma.payrollPeriod.findFirstOrThrow({ where: { companyId: company.id, status: 'OPEN' } });
  const someone = active.find((w) => w.firstName === 'Andrés')!;
  await prisma.payrollNovelty.createMany({
    data: [
      { periodId: nov.id, workerId: active[3].id, type: 'INCAPACIDAD', description: 'Incapacidad médica EPS', days: 3, date: new Date(2026, 10, 4), createdBy: hr.id },
      { periodId: nov.id, workerId: active[5].id, type: 'AUSENCIA', description: 'Ausencia no justificada', days: 1, date: new Date(2026, 10, 9), createdBy: hr.id },
      { periodId: nov.id, workerId: active[7].id, type: 'HORAS_EXTRA', description: 'Inventario de fin de mes', amount: 120_000, date: new Date(2026, 10, 12), createdBy: hr.id },
    ],
  });
  const exc = await prisma.advance.create({
    data: {
      code: `FX-${++advCounter}`,
      workerId: someone.id,
      periodId: nov.id,
      bankAccountId: someone.accounts[0].id,
      amount: 850_000,
      netAmount: 850_000,
      status: 'EXCEPTION',
      availableAtRequest: 900_000,
      recommendedAtRequest: 350_000,
      overRecommended: true,
      warningAcknowledged: true,
      exceptionReason: 'Monto igual o superior al umbral de revisión de la empresa',
      createdAt: new Date(today.getTime() - 3 * 3_600_000),
    },
  });
  await prisma.advanceEvent.createMany({
    data: [
      { advanceId: exc.id, status: 'REQUESTED', actor: someone.userId, createdAt: exc.createdAt },
      { advanceId: exc.id, status: 'EXCEPTION', note: exc.exceptionReason, createdAt: exc.createdAt },
    ],
  });
  await prisma.incident.create({ data: { companyId: company.id, workerId: someone.id, advanceId: exc.id, category: 'ADVANCE_EXCEPTION', title: `Solicitud ${exc.code} requiere revisión`, description: exc.exceptionReason! } });

  await prisma.alert.createMany({
    data: [
      { workerId: valentina.id, type: 'DISBURSED', title: 'Desembolso realizado', message: 'Enviamos $40.000 a tu cuenta Bancolombia.', createdAt: new Date(today.getTime() - 2 * 86_400_000) },
      { workerId: valentina.id, type: 'PERIOD_SUMMARY', title: 'Vas bien este mes', message: 'Has usado menos de la mitad de tu recomendado. Tu próximo pago está protegido.', read: true, createdAt: new Date(today.getTime() - 5 * 86_400_000) },
    ],
  });

  const ticketUser = await prisma.user.findUniqueOrThrow({ where: { email: 'valentina.torres@email.com' } });
  const t = await prisma.supportTicket.create({
    data: { code: 'SOP-DEMO1', userId: ticketUser.id, category: 'Descuento en nómina', subject: '¿Cuándo se descuenta mi retiro?', description: 'Hice un retiro el día 5 y quiero saber si se descuenta en la nómina de este mes.', status: 'WAITING_USER' },
  });
  const flexaAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@flexa.co' } });
  await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: flexaAdmin.id, body: 'Hola Valentina. Los retiros del periodo se descuentan en el pago del 30 de noviembre. Puedes ver el valor en Finanzas > Próximo pago.' } });

  await prisma.auditLog.create({ data: { actorId: hr.id, companyId: company.id, entity: 'Seed', action: 'DEMO_DATA_LOADED' } });

  console.log(`Listo. ${workers.length} trabajadores, ${await prisma.advance.count()} retiros, ${await prisma.payrollPeriod.count()} periodos.`);
  console.log(`Contraseña de todas las cuentas: ${PASSWORD}`);
  console.log('Trabajador: valentina.torres@email.com · Empresa: rrhh@empresa.com / finanzas@empresa.com · FLEXA: admin@flexa.co');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
