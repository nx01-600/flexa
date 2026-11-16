import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { sum } from '../common/util.js';
import { AdvancesService } from '../ewa/advances.service.js';

class CompanyDto {
  @IsString() name: string;
  @IsString() nit: string;
  @IsOptional() @IsInt() @Min(0) pricePerWorker?: number;
  @IsString() adminName: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(8) adminPassword: string;
}
class CompanyUpdateDto {
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'ONBOARDING']) status?: 'ACTIVE' | 'SUSPENDED' | 'ONBOARDING';
  @IsOptional() @IsInt() @Min(0) pricePerWorker?: number;
  @IsOptional() @IsIn(['OK', 'DEGRADED', 'DOWN', 'NOT_CONFIGURED']) integrationStatus?: 'OK' | 'DEGRADED' | 'DOWN' | 'NOT_CONFIGURED';
}
class LegalDto {
  @IsIn(['TERMS', 'DATA_POLICY', 'PAYROLL_DEDUCTION_AUTH']) type: string;
  @IsString() version: string;
  @IsString() title: string;
  @IsString() body: string;
}
class KycDecisionDto {
  @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @IsString() note: string;
}
class IncidentDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED']) status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED';
  @IsOptional() @IsString() resolution?: string;
}

// Administrador FLEXA (rol interno): supervises operations of every company, integrations,
// authorized parameters, exceptions and support. Does not operate the client's payroll.
@Roles('FLEXA_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private advances: AdvancesService,
  ) {}

  @Get('overview')
  async overview() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [companies, workers, adv, incidents, tickets, kyc] = await Promise.all([
      this.prisma.company.groupBy({ by: ['status'], _count: true }),
      this.prisma.worker.count({ where: { enabled: true } }),
      this.prisma.advance.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: true, _sum: { amount: true } }),
      this.prisma.incident.count({ where: { status: { in: ['OPEN', 'ESCALATED'] } } }),
      this.prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
      this.prisma.worker.count({ where: { kycStatus: 'MANUAL_REVIEW' } }),
    ]);
    const disbursed = adv.find((a) => a.status === 'DISBURSED');
    const failed = adv.find((a) => a.status === 'FAILED')?._count ?? 0;
    return {
      companies: Object.fromEntries(companies.map((c) => [c.status, c._count])),
      enabledWorkers: workers,
      last30Days: {
        requests: sum(adv, (a) => a._count),
        disbursed: disbursed?._count ?? 0,
        disbursedAmount: disbursed?._sum.amount ?? 0,
        failed,
        successRatePct: disbursed ? Math.round((disbursed._count / (disbursed._count + failed)) * 100) : 0,
        byStatus: Object.fromEntries(adv.map((a) => [a.status, a._count])),
      },
      openIncidents: incidents,
      openTickets: tickets,
      kycPendingReview: kyc,
    };
  }

  @Get('companies')
  async companies() {
    const list = await this.prisma.company.findMany({ include: { _count: { select: { workers: true } } }, orderBy: { name: 'asc' } });
    const enabled = await this.prisma.worker.groupBy({ by: ['companyId'], where: { enabled: true }, _count: true });
    return list.map(({ apiKey, ...c }) => {
      const n = enabled.find((e) => e.companyId === c.id)?._count ?? 0;
      return { ...c, hasApiKey: !!apiKey, enabledWorkers: n, monthlyRevenue: n * c.pricePerWorker };
    });
  }

  @Post('companies')
  async createCompany(@CurrentUser() u: AuthUser, @Body() dto: CompanyDto) {
    if (await this.prisma.company.findUnique({ where: { nit: dto.nit } })) throw new ConflictException('Ya existe una empresa con ese NIT');
    if (await this.prisma.user.findUnique({ where: { email: dto.adminEmail.toLowerCase() } })) throw new ConflictException('El correo del administrador ya está en uso');
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        nit: dto.nit,
        status: 'ONBOARDING',
        integrationStatus: 'NOT_CONFIGURED',
        pricePerWorker: dto.pricePerWorker,
        settings: { create: {} },
        users: { create: { name: dto.adminName, email: dto.adminEmail.toLowerCase(), role: 'COMPANY_ADMIN', passwordHash: await bcrypt.hash(dto.adminPassword, 10) } },
      },
    });
    await this.audit.log({ actorId: u.sub, companyId: company.id, entity: 'Company', entityId: company.id, action: 'CREATED' });
    return company;
  }

  @Get('companies/:id')
  async company(@Param('id') id: string) {
    const c = await this.prisma.company.findUnique({
      where: { id },
      include: { settings: true, sites: true, users: { select: { id: true, name: true, email: true, role: true, active: true } }, periods: { orderBy: { startDate: 'desc' }, take: 6, include: { reconciliation: true } } },
    });
    if (!c) throw new NotFoundException('Empresa no encontrada');
    const { apiKey, ...rest } = c;
    return { ...rest, hasApiKey: !!apiKey, periods: c.periods.map((p) => ({ ...p, budget: p.budget === null ? null : Number(p.budget) })) };
  }

  @Patch('companies/:id')
  async updateCompany(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CompanyUpdateDto) {
    const c = await this.prisma.company.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: u.sub, companyId: id, entity: 'Company', entityId: id, action: 'UPDATED_BY_FLEXA', data: dto });
    return c;
  }

  // Authorized parameters: FLEXA can adjust a client's rules when they ask for support.
  @Patch('companies/:id/settings')
  async settings(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: Record<string, number | string>) {
    const allowed = ['maxAdvancePct', 'recommendedPct', 'minAmount', 'maxAmountPerRequest', 'maxRequestsPerPeriod', 'feePerRequest', 'blackoutDaysBeforePay', 'alarmUsagePct', 'alarmRequestsCount', 'exceptionAmount'];
    const data = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)).map(([k, v]) => [k, Number(v)]));
    if (!Object.keys(data).length) throw new BadRequestException('Sin parámetros válidos');
    const s = await this.prisma.companySettings.upsert({ where: { companyId: id }, create: { companyId: id, ...data }, update: data });
    await this.audit.log({ actorId: u.sub, companyId: id, entity: 'CompanySettings', entityId: s.id, action: 'UPDATED_BY_FLEXA', data });
    return s;
  }

  @Get('integrations')
  async integrations() {
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true, integrationType: true, integrationStatus: true, erpName: true, lastSyncAt: true } });
    const uploads = await this.prisma.payrollUpload.findMany({ orderBy: { createdAt: 'desc' }, distinct: ['companyId'], select: { companyId: true, status: true, createdAt: true, fileName: true } });
    return companies.map((c) => ({ ...c, lastUpload: uploads.find((x) => x.companyId === c.id) ?? null, stale: !c.lastSyncAt || Date.now() - +c.lastSyncAt > 15 * 86_400_000 }));
  }

  @Get('incidents')
  incidents(@Query('status') status?: string, @Query('companyId') companyId?: string) {
    return this.prisma.incident.findMany({
      where: { ...(status ? { status: status as never } : {}), ...(companyId ? { companyId } : {}) },
      include: { company: { select: { name: true } }, worker: { select: { firstName: true, lastName: true } }, advance: { select: { code: true, status: true, amount: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  @Patch('incidents/:id')
  async incident(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: IncidentDto) {
    if (dto.status === 'RESOLVED' && !dto.resolution) throw new BadRequestException('Describe la resolución');
    const i = await this.prisma.incident.update({
      where: { id },
      data: { status: dto.status, resolution: dto.resolution, ...(dto.status === 'RESOLVED' ? { resolvedById: u.sub, resolvedAt: new Date() } : {}) },
    });
    await this.audit.log({ actorId: u.sub, companyId: i.companyId, entity: 'Incident', entityId: id, action: `FLEXA_${dto.status}`, data: dto });
    return i;
  }

  @Get('advances')
  advancesList(@Query('status') status?: string, @Query('companyId') companyId?: string) {
    return this.prisma.advance.findMany({
      where: { ...(status ? { status: status as never } : {}), ...(companyId ? { worker: { companyId } } : {}) },
      include: { worker: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }, bankAccount: { select: { bank: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  @Post('advances/:id/retry')
  retry(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.advances.retry(null, id, u.sub);
  }

  // KYC cases the provider sent to manual review.
  @Get('kyc')
  kycQueue() {
    return this.prisma.worker.findMany({
      where: { kycStatus: 'MANUAL_REVIEW' },
      select: { id: true, firstName: true, lastName: true, docType: true, docNumber: true, company: { select: { name: true } }, kycChecks: { orderBy: { createdAt: 'desc' }, take: 3 } },
    });
  }

  @Post('kyc/:workerId')
  async kycDecision(@CurrentUser() u: AuthUser, @Param('workerId') workerId: string, @Body() dto: KycDecisionDto) {
    const w = await this.prisma.worker.update({ where: { id: workerId }, data: { kycStatus: dto.status } });
    await this.prisma.kycCheck.create({ data: { workerId, type: 'MANUAL_REVIEW', status: dto.status, provider: 'FLEXA', detail: dto.note } });
    await this.audit.log({ actorId: u.sub, companyId: w.companyId, entity: 'Worker', entityId: workerId, action: `KYC_${dto.status}`, data: { note: dto.note } });
    return w;
  }

  @Get('legal')
  legal() {
    return this.prisma.legalDocument.findMany({ orderBy: [{ type: 'asc' }, { createdAt: 'desc' }] });
  }

  // Publishing a new version deactivates the previous one: workers must accept it again.
  @Post('legal')
  async publishLegal(@CurrentUser() u: AuthUser, @Body() dto: LegalDto) {
    const doc = await this.prisma.$transaction(async (tx) => {
      await tx.legalDocument.updateMany({ where: { type: dto.type }, data: { active: false } });
      return tx.legalDocument.create({ data: dto });
    });
    await this.audit.log({ actorId: u.sub, entity: 'LegalDocument', entityId: doc.id, action: 'PUBLISHED', data: { type: dto.type, version: dto.version } });
    return doc;
  }

  @Get('audit')
  auditLog(@Query('companyId') companyId?: string, @Query('entity') entity?: string, @Query('take') take = '200') {
    return this.prisma.auditLog.findMany({
      where: { ...(companyId ? { companyId } : {}), ...(entity ? { entity } : {}) },
      include: { actor: { select: { name: true, role: true } }, company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take) || 200, 1000),
    });
  }
}
