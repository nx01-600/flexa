import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, Roles, requireCompany } from '../common/auth.js';
import { parseCsv, sum } from '../common/util.js';
import { EarningsService } from '../ewa/earnings.service.js';
import { AdvancesService } from '../ewa/advances.service.js';

class WorkerDto {
  @IsString() docNumber: string;
  @IsOptional() @IsString() docType?: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsString() hireDate?: string;
  @Type(() => Number) @IsInt() @Min(1) baseSalary: number;
}
class UpdateWorkerDto {
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) baseSalary?: number;
  @IsOptional() @IsIn(['RETIRED']) status?: 'RETIRED';
}
class ToggleDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsString() reason?: string;
}
class SettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) maxAdvancePct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) recommendedPct?: number;
  @IsOptional() @IsInt() @Min(0) minAmount?: number;
  @IsOptional() @IsInt() @Min(0) maxAmountPerRequest?: number;
  @IsOptional() @IsInt() @Min(1) maxRequestsPerPeriod?: number;
  @IsOptional() @IsInt() @Min(0) feePerRequest?: number;
  @IsOptional() @IsInt() @Min(0) blackoutDaysBeforePay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) alarmUsagePct?: number;
  @IsOptional() @IsInt() @Min(1) alarmRequestsCount?: number;
  @IsOptional() @IsInt() @Min(0) exceptionAmount?: number;
  @IsOptional() @IsIn(['BIWEEKLY', 'MONTHLY']) payFrequency?: 'BIWEEKLY' | 'MONTHLY';
}
class SiteDto {
  @IsString() name: string;
  @IsString() city: string;
}
class TeamDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsIn(['COMPANY_ADMIN', 'COMPANY_FINANCE']) role: 'COMPANY_ADMIN' | 'COMPANY_FINANCE';
  @IsString() @MinLength(8) password: string;
}
class IncidentDto {
  @IsString() category: string;
  @IsString() title: string;
  @IsString() description: string;
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() advanceId?: string;
}
class IncidentUpdateDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED']) status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED';
  @IsOptional() @IsString() resolution?: string;
}
class DecisionDto {
  @IsString() @MinLength(3) note: string;
}

const ADMIN = ['COMPANY_ADMIN'] as const;
const COMPANY = ['COMPANY_ADMIN', 'COMPANY_FINANCE'] as const;

@Controller('company')
export class CompanyController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private earnings: EarningsService,
    private advances: AdvancesService,
  ) {}

  // ---------- Empresa, parámetros, sedes, equipo ----------

  @Roles(...COMPANY) @Get()
  async company(@CurrentUser() u: AuthUser) {
    const id = requireCompany(u);
    const [company, enabled, total] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id }, include: { settings: true, sites: true } }),
      this.prisma.worker.count({ where: { companyId: id, enabled: true, status: { not: 'RETIRED' } } }),
      this.prisma.worker.count({ where: { companyId: id, status: { not: 'RETIRED' } } }),
    ]);
    const { apiKey, ...rest } = company;
    return { ...rest, hasApiKey: !!apiKey, workers: total, enabledWorkers: enabled, monthlySubscription: enabled * company.pricePerWorker };
  }

  @Roles(...COMPANY) @Get('settings')
  settings(@CurrentUser() u: AuthUser) {
    return this.earnings.settings(requireCompany(u));
  }

  @Roles(...ADMIN) @Patch('settings')
  async updateSettings(@CurrentUser() u: AuthUser, @Body() dto: SettingsDto) {
    const companyId = requireCompany(u);
    const before = await this.earnings.settings(companyId);
    const next = { ...before, ...dto };
    if (next.recommendedPct > next.maxAdvancePct) throw new BadRequestException('El recomendado no puede superar el tope');
    if (next.minAmount > next.maxAmountPerRequest) throw new BadRequestException('El mínimo no puede superar el máximo por solicitud');
    const settings = await this.prisma.companySettings.update({ where: { companyId }, data: dto });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'CompanySettings', entityId: settings.id, action: 'UPDATED', data: { before, after: dto } });
    return settings;
  }

  @Roles(...COMPANY) @Get('sites')
  sites(@CurrentUser() u: AuthUser) {
    return this.prisma.site.findMany({ where: { companyId: requireCompany(u) }, include: { _count: { select: { workers: true } } } });
  }

  @Roles(...ADMIN) @Post('sites')
  createSite(@CurrentUser() u: AuthUser, @Body() dto: SiteDto) {
    return this.prisma.site.create({ data: { ...dto, companyId: requireCompany(u) } });
  }

  @Roles(...COMPANY) @Get('team')
  team(@CurrentUser() u: AuthUser) {
    return this.prisma.user.findMany({
      where: { companyId: requireCompany(u), role: { in: ['COMPANY_ADMIN', 'COMPANY_FINANCE'] } },
      select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true },
    });
  }

  @Roles(...ADMIN) @Post('team')
  async addTeam(@CurrentUser() u: AuthUser, @Body() dto: TeamDto) {
    const companyId = requireCompany(u);
    if (await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })) throw new ConflictException('El correo ya está en uso');
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email.toLowerCase(), role: dto.role, companyId, passwordHash: await bcrypt.hash(dto.password, 10) },
      select: { id: true, name: true, email: true, role: true },
    });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'User', entityId: user.id, action: 'TEAM_MEMBER_ADDED', data: { role: dto.role } });
    return user;
  }

  @Roles(...ADMIN) @Patch('team/:id')
  async toggleTeam(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: { active: boolean }) {
    const companyId = requireCompany(u);
    if (id === u.sub) throw new BadRequestException('No puedes desactivar tu propio usuario');
    const r = await this.prisma.user.updateMany({ where: { id, companyId }, data: { active: !!dto.active } });
    if (!r.count) throw new NotFoundException('Usuario no encontrado');
    await this.audit.log({ actorId: u.sub, companyId, entity: 'User', entityId: id, action: dto.active ? 'ACTIVATED' : 'DEACTIVATED' });
    return { ok: true };
  }

  // ---------- Módulo 5: trabajadores ----------

  @Roles(...COMPANY) @Get('workers')
  async workers(
    @CurrentUser() u: AuthUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('siteId') siteId?: string,
    @Query('enabled') enabled?: string,
  ) {
    const companyId = requireCompany(u);
    const workers = await this.prisma.worker.findMany({
      where: {
        companyId,
        ...(status ? { status: status as never } : {}),
        ...(siteId ? { siteId } : {}),
        ...(enabled ? { enabled: enabled === 'true' } : {}),
        ...(q
          ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { docNumber: { contains: q } }, { email: { contains: q, mode: 'insensitive' } }] }
          : {}),
      },
      include: { site: { select: { name: true, city: true } } },
      orderBy: [{ lastName: 'asc' }],
    });
    const period = await this.earnings.currentPeriod(companyId);
    const totals = period
      ? await this.prisma.advance.groupBy({ by: ['workerId'], where: { periodId: period.id, status: 'DISBURSED' }, _sum: { amount: true }, _count: true })
      : [];
    return workers.map((w) => {
      const t = totals.find((x) => x.workerId === w.id);
      return { ...w, name: `${w.firstName} ${w.lastName}`, withdrawnPeriod: t?._sum.amount ?? 0, advancesPeriod: t?._count ?? 0 };
    });
  }

  @Roles(...COMPANY) @Get('workers/:id')
  async worker(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const companyId = requireCompany(u);
    const worker = await this.prisma.worker.findFirst({
      where: { id, companyId },
      include: {
        site: true,
        kycChecks: { orderBy: { createdAt: 'desc' }, take: 3 },
        consents: { include: { document: { select: { type: true, version: true, title: true } } } },
        accounts: { where: { active: true }, select: { bank: true, type: true, isDefault: true } },
        novelties: { orderBy: { date: 'desc' }, take: 20 },
        incidents: { orderBy: { createdAt: 'desc' }, take: 10 },
        advances: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado');
    const s = await this.earnings.snapshot(id);
    return {
      ...worker,
      ewa: { netEarned: s.netEarned, available: s.available, recommended: s.recommended, used: s.used, usagePct: s.usagePct, blockers: s.blockers },
    };
  }

  @Roles(...ADMIN) @Post('workers')
  async createWorker(@CurrentUser() u: AuthUser, @Body() dto: WorkerDto) {
    const companyId = requireCompany(u);
    return this.upsertWorker(companyId, u.sub, dto, true);
  }

  private async upsertWorker(companyId: string, actorId: string, dto: WorkerDto, failIfExists = false) {
    const exists = await this.prisma.worker.findUnique({ where: { companyId_docNumber: { companyId, docNumber: dto.docNumber } } });
    if (exists && failIfExists) throw new ConflictException('Ya existe un trabajador con ese documento');
    const data = {
      docType: dto.docType ?? 'CC',
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      position: dto.position,
      siteId: dto.siteId,
      contractType: dto.contractType ?? 'INDEFINIDO',
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      baseSalary: dto.baseSalary,
    };
    const worker = exists
      ? await this.prisma.worker.update({ where: { id: exists.id }, data })
      : await this.prisma.worker.create({ data: { ...data, companyId, docNumber: dto.docNumber } });
    await this.audit.log({ actorId, companyId, entity: 'Worker', entityId: worker.id, action: exists ? 'UPDATED' : 'CREATED', data: { baseSalary: dto.baseSalary } });
    return worker;
  }

  // Bulk load: CSV with documento,nombres,apellidos,correo,salario[,cargo,sede,telefono,contrato]
  @Roles(...ADMIN) @Post('workers/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWorkers(@CurrentUser() u: AuthUser, @UploadedFile() file?: { buffer: Buffer; originalname: string }) {
    const companyId = requireCompany(u);
    if (!file) throw new BadRequestException('Adjunta un archivo CSV en el campo "file"');
    const rows = parseCsv(file.buffer.toString('utf8'));
    const sites = await this.prisma.site.findMany({ where: { companyId } });
    const result = { created: 0, updated: 0, errors: [] as { row: number; message: string }[] };
    for (const [i, r] of rows.entries()) {
      const doc = r.documento ?? r.doc ?? r.cedula;
      const salary = Number((r.salario ?? r.salary ?? '').replace(/\D/g, ''));
      const email = r.correo ?? r.email;
      if (!doc || !email || !salary || !(r.nombres ?? r.nombre)) {
        result.errors.push({ row: i + 2, message: 'Faltan documento, nombres, correo o salario' });
        continue;
      }
      const existed = await this.prisma.worker.findUnique({ where: { companyId_docNumber: { companyId, docNumber: doc } } });
      const site = sites.find((s) => [s.name.toLowerCase(), s.city.toLowerCase()].includes((r.sede ?? '').toLowerCase()));
      await this.upsertWorker(companyId, u.sub, {
        docNumber: doc,
        firstName: r.nombres ?? r.nombre,
        lastName: r.apellidos ?? '',
        email,
        baseSalary: salary,
        position: r.cargo,
        phone: r.telefono,
        contractType: r.contrato,
        siteId: site?.id,
      });
      if (existed) result.updated++;
      else result.created++;
    }
    return result;
  }

  @Roles(...ADMIN) @Patch('workers/:id')
  async updateWorker(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    const companyId = requireCompany(u);
    const before = await this.prisma.worker.findFirst({ where: { id, companyId } });
    if (!before) throw new NotFoundException('Trabajador no encontrado');
    const worker = await this.prisma.worker.update({
      where: { id },
      data: { ...dto, ...(dto.status === 'RETIRED' ? { enabled: false } : {}) },
    });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Worker', entityId: id, action: 'LABOR_INFO_UPDATED', data: { before: { baseSalary: before.baseSalary, position: before.position, siteId: before.siteId }, after: dto } });
    return worker;
  }

  @Roles(...ADMIN) @Post('workers/:id/access')
  async toggle(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ToggleDto) {
    const companyId = requireCompany(u);
    const w = await this.prisma.worker.findFirst({ where: { id, companyId } });
    if (!w) throw new NotFoundException('Trabajador no encontrado');
    if (w.status === 'RETIRED' && dto.enabled) throw new BadRequestException('El trabajador está retirado');
    if (!dto.enabled && !dto.reason) throw new BadRequestException('Indica el motivo de la deshabilitación');
    const status = dto.enabled ? (w.userId ? (w.kycStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING_KYC') : 'INVITED') : 'DISABLED';
    const worker = await this.prisma.worker.update({ where: { id }, data: { enabled: dto.enabled, status, disabledReason: dto.enabled ? null : dto.reason } });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Worker', entityId: id, action: dto.enabled ? 'ENABLED' : 'DISABLED', data: { reason: dto.reason } });
    return worker;
  }

  @Roles(...ADMIN) @Post('workers/access')
  async bulkToggle(@CurrentUser() u: AuthUser, @Body() dto: { ids: string[]; enabled: boolean; reason?: string }) {
    const out = [];
    for (const id of dto.ids ?? []) out.push(await this.toggle(u, id, { enabled: dto.enabled, reason: dto.reason ?? 'Cambio masivo' }));
    return { updated: out.length };
  }

  // ---------- Incidencias y novedades de operación ----------

  @Roles(...COMPANY) @Get('incidents')
  incidents(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('category') category?: string) {
    return this.prisma.incident.findMany({
      where: { companyId: requireCompany(u), ...(status ? { status: status as never } : {}), ...(category ? { category } : {}) },
      include: { worker: { select: { firstName: true, lastName: true, docNumber: true } }, advance: { select: { code: true, amount: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(...ADMIN) @Post('incidents')
  async createIncident(@CurrentUser() u: AuthUser, @Body() dto: IncidentDto) {
    const companyId = requireCompany(u);
    const incident = await this.prisma.incident.create({ data: { ...dto, companyId } });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Incident', entityId: incident.id, action: 'CREATED' });
    return incident;
  }

  @Roles(...ADMIN) @Patch('incidents/:id')
  async updateIncident(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: IncidentUpdateDto) {
    const companyId = requireCompany(u);
    if (dto.status === 'RESOLVED' && !dto.resolution) throw new BadRequestException('Describe cómo se resolvió');
    const r = await this.prisma.incident.updateMany({
      where: { id, companyId },
      data: { status: dto.status, resolution: dto.resolution, ...(dto.status === 'RESOLVED' ? { resolvedById: u.sub, resolvedAt: new Date() } : {}) },
    });
    if (!r.count) throw new NotFoundException('Incidencia no encontrada');
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Incident', entityId: id, action: dto.status, data: dto });
    return this.prisma.incident.findUnique({ where: { id } });
  }

  // ---------- Módulo 7: administración de accesos EWA ----------

  @Roles(...COMPANY) @Get('advances')
  async listAdvances(
    @CurrentUser() u: AuthUser,
    @Query('status') status?: string,
    @Query('periodId') periodId?: string,
    @Query('workerId') workerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.advance.findMany({
      where: {
        worker: { companyId: requireCompany(u) },
        ...(status ? { status: status as never } : {}),
        ...(periodId ? { periodId } : {}),
        ...(workerId ? { workerId } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      include: {
        worker: { select: { firstName: true, lastName: true, docNumber: true, site: { select: { name: true } } } },
        bankAccount: { select: { bank: true } },
        period: { select: { label: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Roles(...COMPANY) @Get('advances/:id')
  async advance(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const a = await this.advances.detail(id);
    if (!a) throw new NotFoundException('Solicitud no encontrada');
    const owner = await this.prisma.worker.findFirst({ where: { id: a.workerId, companyId: requireCompany(u) } });
    if (!owner) throw new NotFoundException('Solicitud no encontrada');
    const audit = await this.prisma.auditLog.findMany({ where: { entity: 'Advance', entityId: id }, orderBy: { createdAt: 'asc' } });
    return { ...a, audit };
  }

  @Roles(...ADMIN) @Post('advances/:id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.advances.resolveException(requireCompany(u), id, u.sub, true, dto.note);
  }

  @Roles(...ADMIN) @Post('advances/:id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.advances.resolveException(requireCompany(u), id, u.sub, false, dto.note);
  }

  @Roles(...ADMIN) @Post('advances/:id/retry')
  retry(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.advances.retry(requireCompany(u), id, u.sub);
  }

  // Aggregated EWA usage + the rules applied (what HR supervises without approving each request).
  @Roles(...COMPANY) @Get('ewa/summary')
  async ewaSummary(@CurrentUser() u: AuthUser, @Query('periodId') periodId?: string) {
    const companyId = requireCompany(u);
    const period = periodId
      ? await this.prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId } })
      : await this.earnings.currentPeriod(companyId);
    if (!period) return { period: null };
    const [advances, settings, enabledWorkers, openIncidents] = await Promise.all([
      this.prisma.advance.findMany({ where: { periodId: period.id }, select: { amount: true, fee: true, status: true, workerId: true, overRecommended: true } }),
      this.earnings.settings(companyId),
      this.prisma.worker.count({ where: { companyId, enabled: true } }),
      this.prisma.incident.count({ where: { companyId, status: { not: 'RESOLVED' } } }),
    ]);
    const disbursed = advances.filter((a) => a.status === 'DISBURSED');
    const byStatus = Object.fromEntries(
      ['APPROVED', 'DISBURSING', 'DISBURSED', 'EXCEPTION', 'REJECTED', 'FAILED', 'CANCELLED'].map((s) => [s, advances.filter((a) => a.status === s).length]),
    );
    const users = new Set(disbursed.map((a) => a.workerId)).size;
    return {
      period: { id: period.id, label: period.label, payDate: period.payDate, status: period.status },
      requests: advances.length,
      byStatus,
      disbursedAmount: sum(disbursed, (a) => a.amount),
      feesAmount: sum(disbursed, (a) => a.fee),
      averageAmount: disbursed.length ? Math.round(sum(disbursed, (a) => a.amount) / disbursed.length) : 0,
      activeUsers: users,
      enabledWorkers,
      adoptionPct: enabledWorkers ? Math.round((users / enabledWorkers) * 100) : 0,
      overRecommendedPct: disbursed.length ? Math.round((disbursed.filter((a) => a.overRecommended).length / disbursed.length) * 100) : 0,
      pendingExceptions: byStatus.EXCEPTION,
      openIncidents,
      rules: settings,
    };
  }

  // ---------- Módulo 10: trazabilidad ----------

  @Roles(...COMPANY) @Get('audit')
  auditLog(@CurrentUser() u: AuthUser, @Query('entity') entity?: string, @Query('entityId') entityId?: string, @Query('take') take = '200') {
    return this.prisma.auditLog.findMany({
      where: { companyId: requireCompany(u), ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}) },
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take) || 200, 1000),
    });
  }
}
