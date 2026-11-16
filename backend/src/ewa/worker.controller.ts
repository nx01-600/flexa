import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { KycProvider } from '../common/providers.js';
import { type AuthUser, CurrentUser, Roles, requireWorker } from '../common/auth.js';
import { code, DAY, toCsv } from '../common/util.js';
import { EarningsService } from './earnings.service.js';
import { AdvancesService } from './advances.service.js';

class UpdateProfileDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
class KycDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1) selfieScore?: number;
}
class AccountDto {
  @IsString() bank: string;
  @IsIn(['SAVINGS', 'CHECKING', 'WALLET']) type: 'SAVINGS' | 'CHECKING' | 'WALLET';
  @IsString() number: string;
  @IsOptional() @IsString() holder?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
class AmountDto {
  @Type(() => Number) @IsInt() @Min(1) amount: number;
}
class AdvanceDto extends AmountDto {
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsBoolean() acknowledgeWarnings?: boolean;
}
class PaymentDto extends AmountDto {
  @IsIn(['PAGO', 'RECARGA']) kind: 'PAGO' | 'RECARGA';
  @IsString() category: string;
  @IsString() biller: string;
  @IsString() reference: string;
}

// Worker onboarding state: ACTIVE once KYC, consents and a destination account are in place.
@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async refresh(workerId: string) {
    const w = await this.prisma.worker.findUniqueOrThrow({
      where: { id: workerId },
      include: { consents: { include: { document: true } }, accounts: { where: { active: true } } },
    });
    const types = new Set(w.consents.map((c) => c.document.type));
    const required = await this.prisma.legalDocument.findMany({ where: { active: true } });
    const steps = {
      registered: !!w.userId,
      kyc: w.kycStatus === 'APPROVED',
      consents: required.every((d) => types.has(d.type)),
      account: w.accounts.length > 0,
    };
    const complete = Object.values(steps).every(Boolean);
    if (w.enabled && ['INVITED', 'PENDING_KYC', 'ACTIVE'].includes(w.status)) {
      const status = complete ? 'ACTIVE' : 'PENDING_KYC';
      if (status !== w.status) await this.prisma.worker.update({ where: { id: workerId }, data: { status } });
    }
    return { steps, complete };
  }
}

@Roles('WORKER')
@Controller('worker')
export class WorkerController {
  constructor(
    private prisma: PrismaService,
    private earnings: EarningsService,
    private advances: AdvancesService,
    private audit: AuditService,
    private kyc: KycProvider,
    private onboarding: OnboardingService,
  ) {}

  // ---------- Módulo 1: acceso y perfil ----------

  @Get('profile')
  async profile(@CurrentUser() u: AuthUser) {
    const id = requireWorker(u);
    const worker = await this.prisma.worker.findUniqueOrThrow({
      where: { id },
      include: { company: { select: { name: true, nit: true } }, site: true },
    });
    return { ...worker, onboarding: await this.onboarding.refresh(id) };
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    const id = requireWorker(u);
    const worker = await this.prisma.worker.update({ where: { id }, data: dto });
    if (dto.email) await this.prisma.user.update({ where: { id: u.sub }, data: { email: dto.email.toLowerCase() } });
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'Worker', entityId: id, action: 'PROFILE_UPDATED', data: dto });
    return worker;
  }

  @Get('kyc')
  kycStatus(@CurrentUser() u: AuthUser) {
    return this.prisma.kycCheck.findMany({ where: { workerId: requireWorker(u) }, orderBy: { createdAt: 'desc' } });
  }

  // Identity validation: document, selfie biometrics and antifraud through the KYC provider.
  @Post('kyc')
  async runKyc(@CurrentUser() u: AuthUser, @Body() dto: KycDto) {
    const id = requireWorker(u);
    const worker = await this.prisma.worker.findUniqueOrThrow({ where: { id } });
    if (worker.kycStatus === 'APPROVED') return { status: 'APPROVED', checks: [] };
    const result = this.kyc.verify({ docNumber: worker.docNumber, selfieScore: dto.selfieScore });
    const checks = await this.prisma.$transaction([
      ...['DOCUMENT', 'SELFIE_BIOMETRIC', 'ANTIFRAUD'].map((type) =>
        this.prisma.kycCheck.create({
          data: {
            workerId: id,
            type,
            status: type === 'DOCUMENT' && result.status === 'REJECTED' ? 'APPROVED' : result.status,
            score: type === 'SELFIE_BIOMETRIC' ? result.score : null,
            providerRef: result.ref,
          },
        }),
      ),
      this.prisma.worker.update({ where: { id }, data: { kycStatus: result.status } }),
    ]);
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'Worker', entityId: id, action: 'KYC', data: result });
    await this.onboarding.refresh(id);
    return { status: result.status, checks: checks.slice(0, 3) };
  }

  @Get('legal')
  async legal(@CurrentUser() u: AuthUser) {
    const id = requireWorker(u);
    const [docs, consents] = await Promise.all([
      this.prisma.legalDocument.findMany({ where: { active: true }, orderBy: { type: 'asc' } }),
      this.prisma.consent.findMany({ where: { workerId: id } }),
    ]);
    return docs.map((d) => ({ ...d, acceptedAt: consents.find((c) => c.documentId === d.id)?.acceptedAt ?? null }));
  }

  @Post('legal/:id/accept')
  async accept(@CurrentUser() u: AuthUser, @Param('id') docId: string, @Req() req: { ip?: string }) {
    const id = requireWorker(u);
    const doc = await this.prisma.legalDocument.findFirst({ where: { id: docId, active: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    const consent = await this.prisma.consent.upsert({
      where: { workerId_documentId: { workerId: id, documentId: docId } },
      create: { workerId: id, documentId: docId, ip: req.ip },
      update: {},
    });
    await this.prisma.document.create({ data: { workerId: id, type: 'CONSENT', title: `${doc.title} v${doc.version}`, refId: consent.id } });
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'Consent', entityId: consent.id, action: 'ACCEPTED', data: { type: doc.type, version: doc.version } });
    await this.onboarding.refresh(id);
    return consent;
  }

  @Get('accounts')
  accounts(@CurrentUser() u: AuthUser) {
    return this.prisma.bankAccount.findMany({ where: { workerId: requireWorker(u), active: true }, orderBy: { createdAt: 'asc' } });
  }

  @Post('accounts')
  async addAccount(@CurrentUser() u: AuthUser, @Body() dto: AccountDto) {
    const id = requireWorker(u);
    const count = await this.prisma.bankAccount.count({ where: { workerId: id, active: true } });
    const isDefault = dto.isDefault || count === 0;
    if (isDefault) await this.prisma.bankAccount.updateMany({ where: { workerId: id }, data: { isDefault: false } });
    const account = await this.prisma.bankAccount.create({
      data: { workerId: id, bank: dto.bank, type: dto.type, number: dto.number, holder: dto.holder ?? u.name, isDefault, verified: true },
    });
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'BankAccount', entityId: account.id, action: 'CREATED' });
    await this.onboarding.refresh(id);
    return account;
  }

  @Post('accounts/:id/default')
  async setDefault(@CurrentUser() u: AuthUser, @Param('id') accountId: string) {
    const id = requireWorker(u);
    await this.owned(id, accountId);
    await this.prisma.$transaction([
      this.prisma.bankAccount.updateMany({ where: { workerId: id }, data: { isDefault: false } }),
      this.prisma.bankAccount.update({ where: { id: accountId }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  @Delete('accounts/:id')
  async removeAccount(@CurrentUser() u: AuthUser, @Param('id') accountId: string) {
    const id = requireWorker(u);
    await this.owned(id, accountId);
    await this.prisma.bankAccount.update({ where: { id: accountId }, data: { active: false, isDefault: false } });
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'BankAccount', entityId: accountId, action: 'REMOVED' });
    await this.onboarding.refresh(id);
    return { ok: true };
  }

  private async owned(workerId: string, accountId: string) {
    const acc = await this.prisma.bankAccount.findFirst({ where: { id: accountId, workerId, active: true } });
    if (!acc) throw new NotFoundException('Cuenta no encontrada');
    return acc;
  }

  // ---------- Módulo 2: devengado y disponibilidad ----------

  @Get('earnings')
  async summary(@CurrentUser() u: AuthUser) {
    const s = await this.earnings.snapshot(requireWorker(u));
    return {
      period: s.period && { id: s.period.id, label: s.period.label, startDate: s.period.startDate, endDate: s.period.endDate, payDate: s.period.payDate },
      baseSalary: s.baseSalary,
      periodSalary: s.periodSalary,
      workedDays: s.workedDays,
      periodDays: s.periodDays,
      grossEarned: s.grossEarned,
      netEarned: s.netEarned,
      used: s.used,
      advancedAmount: s.advancedAmount,
      paymentsAmount: s.paymentsAmount,
      available: s.available,
      recommended: s.recommended,
      projectedNet: s.projectedNet,
      nextPayAfterUsage: s.nextPayAfterUsage,
      usagePct: s.usagePct,
      limits: {
        maxAdvancePct: s.settings.maxAdvancePct,
        recommendedPct: s.settings.recommendedPct,
        limitAmount: s.limit,
        minAmount: s.settings.minAmount,
        maxAmountPerRequest: s.settings.maxAmountPerRequest,
        maxRequestsPerPeriod: s.settings.maxRequestsPerPeriod,
        requestsUsed: s.requestsCount,
        feePerRequest: s.settings.feePerRequest,
        blackoutDaysBeforePay: s.settings.blackoutDaysBeforePay,
      },
      canRequest: s.blockers.length === 0 && s.available >= s.settings.minAmount,
      blockers: s.blockers,
      dataUpdatedAt: s.dataUpdatedAt,
    };
  }

  @Get('earnings/explanation')
  async explanation(@CurrentUser() u: AuthUser) {
    return this.earnings.explain(await this.earnings.snapshot(requireWorker(u)));
  }

  // Earned curve by week of the current period (chart on the home screen).
  @Get('earnings/weekly')
  async weekly(@CurrentUser() u: AuthUser) {
    const id = requireWorker(u);
    const now = await this.earnings.snapshot(id);
    if (!now.period) return [];
    const out: { week: string; value: number }[] = [];
    const start = now.period.startDate.getTime();
    for (let i = 1; i * 7 <= now.periodDays + 6; i++) {
      const at = new Date(Math.min(start + (i * 7 - 1) * DAY, now.period.endDate.getTime()));
      if (at > new Date()) break;
      const s = await this.earnings.snapshot(id, this.prisma, at);
      out.push({ week: `Sem ${i}`, value: s.netEarned });
    }
    if (!out.length || out[out.length - 1].value !== now.netEarned) out.push({ week: 'Hoy', value: now.netEarned });
    return out;
  }

  // ---------- Módulos 3 y 4: simulación, solicitud y bienestar ----------

  @Post('simulate')
  async simulate(@CurrentUser() u: AuthUser, @Body() dto: AmountDto) {
    return this.earnings.simulate(await this.earnings.snapshot(requireWorker(u)), dto.amount);
  }

  @Post('advances')
  request(@CurrentUser() u: AuthUser, @Body() dto: AdvanceDto) {
    return this.advances.request(requireWorker(u), u.sub, dto);
  }

  @Get('advances')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string) {
    return this.prisma.advance.findMany({
      where: { workerId: requireWorker(u), ...(status ? { status: status as never } : {}) },
      include: { bankAccount: { select: { bank: true, number: true } }, period: { select: { label: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('advances/:id')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const a = await this.advances.detail(id);
    if (!a || a.workerId !== requireWorker(u)) throw new NotFoundException('Solicitud no encontrada');
    return a;
  }

  @Post('advances/:id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.advances.cancel(requireWorker(u), id, u.sub);
  }

  // Receipt data for a disbursed advance or a service payment.
  @Get('receipts/:code')
  async receipt(@CurrentUser() u: AuthUser, @Param('code') ref: string) {
    const workerId = requireWorker(u);
    const advance = await this.prisma.advance.findFirst({
      where: { workerId, OR: [{ id: ref }, { code: ref }] },
      include: { bankAccount: true, worker: { include: { company: true } } },
    });
    if (advance) {
      return {
        kind: 'RETIRO',
        code: advance.code,
        status: advance.status,
        date: advance.disbursedAt ?? advance.createdAt,
        amount: advance.amount,
        fee: advance.fee,
        received: advance.netAmount,
        destination: `${advance.bankAccount.bank} ${advance.bankAccount.number}`,
        worker: `${advance.worker.firstName} ${advance.worker.lastName}`,
        doc: `${advance.worker.docType} ${advance.worker.docNumber}`,
        company: advance.worker.company.name,
        providerRef: advance.providerRef,
        note: 'Este valor se descontará de tu próximo pago de nómina.',
      };
    }
    const payment = await this.prisma.servicePayment.findFirst({ where: { workerId, OR: [{ id: ref }, { code: ref }] } });
    if (!payment) throw new NotFoundException('Comprobante no encontrado');
    return { kind: payment.kind, code: payment.code, status: payment.status, date: payment.createdAt, amount: payment.amount, fee: 0, received: payment.amount, destination: `${payment.biller} ${payment.reference}`, category: payment.category };
  }

  @Get('wellness')
  async wellness(@CurrentUser() u: AuthUser) {
    const id = requireWorker(u);
    const s = await this.earnings.snapshot(id);
    const history = await this.prisma.advance.groupBy({
      by: ['periodId'],
      where: { workerId: id, status: 'DISBURSED' },
      _sum: { amount: true },
      _count: true,
    });
    const periods = await this.prisma.payrollPeriod.findMany({ where: { id: { in: history.map((h) => h.periodId) } } });
    const tips = [
      'Retirar solo lo necesario protege tu quincena.',
      'Revisa tus gastos fijos antes de retirar.',
      'Mantenerte por debajo del recomendado te deja más libertad el día de pago.',
    ];
    return {
      recommended: s.recommended,
      available: s.available,
      used: s.used,
      usagePct: s.usagePct,
      overRecommended: s.used > (s.netEarned * s.settings.recommendedPct) / 100,
      nextPayAfterUsage: s.nextPayAfterUsage,
      projectedNet: s.projectedNet,
      alarmThresholds: { usagePct: s.settings.alarmUsagePct, requests: s.settings.alarmRequestsCount },
      byPeriod: history
        .map((h) => ({ period: periods.find((p) => p.id === h.periodId)?.label, startDate: periods.find((p) => p.id === h.periodId)?.startDate, total: h._sum.amount ?? 0, count: h._count }))
        .sort((a, b) => +(a.startDate ?? 0) - +(b.startDate ?? 0)),
      tips,
    };
  }

  @Get('alerts')
  alerts(@CurrentUser() u: AuthUser, @Query('unread') unread?: string) {
    return this.prisma.alert.findMany({
      where: { workerId: requireWorker(u), ...(unread === 'true' ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Patch('alerts/:id/read')
  async readAlert(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.prisma.alert.updateMany({ where: { id, workerId: requireWorker(u) }, data: { read: true } });
    return { ok: true };
  }

  @Post('alerts/read-all')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.alert.updateMany({ where: { workerId: requireWorker(u) }, data: { read: true } });
    return { ok: true };
  }

  // Bill payments / top-ups paid from the available balance.
  @Post('payments')
  async pay(@CurrentUser() u: AuthUser, @Body() dto: PaymentDto) {
    const id = requireWorker(u);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const s = await this.earnings.snapshot(id, tx);
      const blockers = s.blockers.filter((b) => !b.includes('solicitudes'));
      if (blockers.length) throw new BadRequestException(blockers[0]);
      if (dto.amount > s.available) throw new BadRequestException('El monto supera tu disponible');
      const payment = await tx.servicePayment.create({
        data: { ...dto, code: code('SP'), workerId: id, periodId: s.period!.id },
      });
      await tx.document.create({ data: { workerId: id, type: 'RECEIPT', title: `Comprobante ${payment.code}`, refId: payment.id } });
      await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'ServicePayment', entityId: payment.id, action: 'PAID', data: dto }, tx);
      return payment;
    });
  }

  // ---------- Módulo 10: historial, documentos, movimientos ----------

  @Get('movements')
  async movements(@CurrentUser() u: AuthUser, @Query('kind') kind?: string) {
    const id = requireWorker(u);
    const [advances, payments] = await Promise.all([
      kind && kind !== 'retiro' ? [] : this.prisma.advance.findMany({ where: { workerId: id }, include: { bankAccount: true } }),
      kind === 'retiro' ? [] : this.prisma.servicePayment.findMany({ where: { workerId: id, ...(kind ? { kind: kind.toUpperCase() } : {}) } }),
    ]);
    return [
      ...advances.map((a) => ({
        id: a.id,
        code: a.code,
        kind: 'retiro' as const,
        title: `Retiro a ${a.bankAccount.bank}`,
        amount: a.amount,
        dest: a.bankAccount.bank,
        account: a.bankAccount.number,
        status: a.status,
        date: a.createdAt,
      })),
      ...payments.map((p) => ({
        id: p.id,
        code: p.code,
        kind: p.kind === 'RECARGA' ? ('recarga' as const) : ('pago' as const),
        title: p.kind === 'RECARGA' ? `Recarga ${p.biller}` : `Pago ${p.biller}`,
        amount: p.amount,
        dest: p.biller,
        account: p.reference,
        status: p.status,
        date: p.createdAt,
      })),
    ].sort((a, b) => +b.date - +a.date);
  }

  @Get('documents')
  documents(@CurrentUser() u: AuthUser) {
    return this.prisma.document.findMany({ where: { workerId: requireWorker(u) }, orderBy: { createdAt: 'desc' } });
  }

  @Get('history/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="historial-flexa.csv"')
  async export(@CurrentUser() u: AuthUser) {
    const rows = await this.movements(u);
    return toCsv(rows.map((r) => ({ fecha: r.date, tipo: r.kind, codigo: r.code, detalle: r.title, monto: r.amount, estado: r.status })));
  }
}
