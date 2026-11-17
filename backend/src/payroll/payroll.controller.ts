import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, Public, Roles, requireCompany } from '../common/auth.js';
import { INT_MAX, csvUpload, exceedsVariance, parseAmount, parseCsv } from '../common/util.js';
import type { IntegrationType } from '../generated/prisma/enums.js';

class PeriodDto {
  @IsString() label: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsString() payDate: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) budget?: number;
}
class BudgetDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) budget: number;
}
class RotateKeyDto {
  @IsOptional() @IsString() @MaxLength(100) erpName?: string;
}
class EntryDto {
  @IsOptional() @Type(() => Number) @IsInt() baseSalary?: number;
  @IsOptional() @Type(() => Number) @IsInt() workedDays?: number;
  @IsOptional() @Type(() => Number) overtimeHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() overtimeAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() surcharges?: number;
  @IsOptional() @Type(() => Number) @IsInt() deductions?: number;
}
class NoveltyDto {
  @IsString() workerId: string;
  @IsOptional() @IsString() periodId?: string;
  @IsString() type: string;
  @IsString() description: string;
  @IsOptional() @Type(() => Number) @IsInt() days?: number;
  @IsOptional() @Type(() => Number) @IsInt() amount?: number;
  @IsOptional() @IsString() date?: string;
}
class ErpSyncDto {
  @IsOptional() @IsString() periodId?: string;
  @IsArray() @IsObject({ each: true }) entries: Record<string, unknown>[];
}

// Normalized payroll row: CSV cells are strings, ERP JSON values keep their type.
type Row = Record<string, unknown>;
type Issue = { row: number; docNumber?: string; field: string; message: string; severity?: string };
// undefined = not reported, NaN = reported but unreadable.
const num = (v: unknown, decimals = 0) =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) ? undefined : (parseAmount(v, decimals) ?? NaN);

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Validates each row, writes entries for the valid ones and records issues for the rest.
  async ingest(companyId: string, periodId: string, rows: Row[], source: IntegrationType, fileName: string, actorId?: string) {
    const period = await this.prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    if (period.status !== 'OPEN') throw new BadRequestException('El periodo ya está cerrado');

    const upload = await this.prisma.payrollUpload.create({
      data: { companyId, periodId, source, fileName, totalRows: rows.length, uploadedBy: actorId },
    });
    const issues: Issue[] = [];
    let ok = 0;
    // From here the upload must always end in a final status, never stay PROCESSING.
    try {
      const workers = await this.prisma.worker.findMany({ where: { companyId } });
      const byDoc = new Map(workers.map((w) => [w.docNumber.replace(/\D/g, ''), w]));
      const seen = new Set<string>();
      const periodDays = Math.round((+period.endDate - +period.startDate) / 86_400_000) + 1;

      for (const [i, r] of rows.entries()) {
        const rowNo = i + 2;
        const doc = String(r.documento ?? r.doc ?? r.docnumber ?? r.cedula ?? '').replace(/\D/g, '');
        // One bad row becomes an issue; it never aborts the rest of the upload.
        try {
          const salary = num(r.salario ?? r.basesalary ?? r.salario_base);
          const days = num(r.dias_trabajados ?? r.workeddays ?? r.dias, 2);
          const otHours = num(r.horas_extra ?? r.overtimehours, 2);
          const otAmount = num(r.valor_horas_extra ?? r.overtimeamount);
          const surcharges = num(r.recargos ?? r.surcharges);
          const deductions = num(r.deducciones ?? r.deductions);
          const rowIssues: Issue[] = [];

          if (!doc) rowIssues.push({ row: rowNo, field: 'documento', message: 'Documento faltante' });
          const worker = doc ? byDoc.get(doc) : undefined;
          if (doc && !worker) rowIssues.push({ row: rowNo, docNumber: doc, field: 'documento', message: 'El trabajador no está registrado en FLEXA' });
          if (doc && seen.has(doc)) rowIssues.push({ row: rowNo, docNumber: doc, field: 'documento', message: 'Documento duplicado en el archivo' });
          // Marked even when the row fails, so a rejected row is not also reported as missing from the file.
          if (doc) seen.add(doc);
          if (salary === undefined) rowIssues.push({ row: rowNo, docNumber: doc, field: 'salario', message: 'Salario faltante' });
          else if (salary === 0) rowIssues.push({ row: rowNo, docNumber: doc, field: 'salario', message: 'El salario debe ser mayor a 0' });
          for (const [field, v] of Object.entries({ salario: salary, dias_trabajados: days, horas_extra: otHours, valor_horas_extra: otAmount, recargos: surcharges, deducciones: deductions })) {
            if (Number.isNaN(v) || (v ?? 0) < 0 || (v ?? 0) > INT_MAX) rowIssues.push({ row: rowNo, docNumber: doc, field, message: 'Valor inválido' });
          }
          if (days !== undefined && Number.isFinite(days)) {
            if (!Number.isInteger(days)) rowIssues.push({ row: rowNo, docNumber: doc, field: 'dias_trabajados', message: 'Los días trabajados deben ser un número entero' });
            else if (days > periodDays) rowIssues.push({ row: rowNo, docNumber: doc, field: 'dias_trabajados', message: `Supera los ${periodDays} días del periodo` });
          }
          if (rowIssues.length || !worker) {
            issues.push(...rowIssues);
            continue;
          }
          // A salary far from the registered one is rejected, not applied: the admin confirms it via PATCH periods/:id/entries/:workerId.
          if (exceedsVariance(salary!, worker.baseSalary)) {
            issues.push({ row: rowNo, docNumber: doc, field: 'salario', message: `Variación mayor al 30 % frente al salario registrado (${worker.baseSalary}); no se aplicó, corrígelo manualmente si es correcto` });
            continue;
          }
          // Warnings don't block the row but are flagged for review.
          if (otHours && !otAmount)
            issues.push({ row: rowNo, docNumber: doc, field: 'valor_horas_extra', message: 'Reporta horas extra sin valor', severity: 'WARNING' });

          const data = {
            baseSalary: salary!,
            workedDays: days ?? 0,
            overtimeHours: otHours ?? 0,
            overtimeAmount: otAmount ?? 0,
            surcharges: surcharges ?? 0,
            deductions: deductions ?? 0,
            uploadId: upload.id,
          };
          // Entry and registered salary change together or not at all.
          await this.prisma.$transaction([
            this.prisma.payrollEntry.upsert({
              where: { periodId_workerId: { periodId, workerId: worker.id } },
              create: { ...data, periodId, workerId: worker.id },
              update: data,
            }),
            ...(salary !== worker.baseSalary ? [this.prisma.worker.update({ where: { id: worker.id }, data: { baseSalary: salary! } })] : []),
          ]);
          ok++;
        } catch (e) {
          this.logger.error(`Upload ${upload.id} row ${rowNo}: ${e instanceof Error ? e.message : String(e)}`);
          issues.push({ row: rowNo, docNumber: doc || undefined, field: 'fila', message: 'Error inesperado al procesar la fila' });
        }
      }

      // Enabled workers missing from the file.
      const missing = workers.filter((w) => w.enabled && w.status !== 'RETIRED' && !seen.has(w.docNumber.replace(/\D/g, '')));
      if (source === 'FILE' || rows.length > 1)
        for (const w of missing) issues.push({ row: 0, docNumber: w.docNumber, field: 'documento', message: `Trabajador habilitado sin información en la nómina (${w.firstName} ${w.lastName})`, severity: 'WARNING' });

      if (issues.length) await this.prisma.payrollIssue.createMany({ data: issues.map((x) => ({ ...x, uploadId: upload.id, severity: x.severity ?? 'ERROR' })) });
      const status = ok === 0 && rows.length ? 'FAILED' : issues.length ? 'WITH_ISSUES' : 'PROCESSED';
      await this.prisma.payrollUpload.update({ where: { id: upload.id }, data: { okRows: ok, status } });
    } catch (e) {
      this.logger.error(`Upload ${upload.id} aborted: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
      await this.prisma.payrollUpload.update({ where: { id: upload.id }, data: { okRows: ok, status: 'FAILED' } }).catch(() => undefined);
      await this.prisma.payrollIssue
        .create({ data: { uploadId: upload.id, row: 0, field: 'archivo', message: 'La carga se interrumpió por un error interno', severity: 'ERROR' } })
        .catch(() => undefined);
      throw e;
    }

    const hasErrors = issues.some((x) => (x.severity ?? 'ERROR') === 'ERROR');
    await this.prisma.company.update({ where: { id: companyId }, data: { lastSyncAt: new Date(), integrationStatus: hasErrors ? 'DEGRADED' : 'OK' } });
    if (hasErrors)
      await this.prisma.incident.create({
        data: { companyId, category: 'PAYROLL_DATA', title: `Inconsistencias en ${fileName}`, description: `${issues.filter((x) => x.severity !== 'WARNING').length} filas con errores en la nómina de ${period.label}` },
      });
    await this.audit.log({ actorId, companyId, entity: 'PayrollUpload', entityId: upload.id, action: 'INGESTED', data: { source, fileName, rows: rows.length, ok, issues: issues.length } });
    return this.prisma.payrollUpload.findUnique({ where: { id: upload.id }, include: { issues: true } });
  }
}

const ADMIN = ['COMPANY_ADMIN'] as const;
const COMPANY = ['COMPANY_ADMIN', 'COMPANY_FINANCE'] as const;

@Controller('payroll')
export class PayrollController {
  constructor(
    private prisma: PrismaService,
    private payroll: PayrollService,
    private audit: AuditService,
  ) {}

  @Roles(...COMPANY) @Get('periods')
  periods(@CurrentUser() u: AuthUser) {
    return this.prisma.payrollPeriod
      .findMany({
        where: { companyId: requireCompany(u) },
        include: { _count: { select: { entries: true, advances: true, uploads: true } }, reconciliation: { select: { status: true } } },
        orderBy: { startDate: 'desc' },
      })
      .then((ps) => ps.map((p) => ({ ...p, budget: p.budget === null ? null : Number(p.budget) })));
  }

  @Roles(...ADMIN) @Post('periods')
  async createPeriod(@CurrentUser() u: AuthUser, @Body() dto: PeriodDto) {
    const companyId = requireCompany(u);
    const [start, end, pay] = [new Date(dto.startDate), new Date(dto.endDate), new Date(dto.payDate)];
    if (!(start < end) || pay < end) throw new BadRequestException('Fechas del periodo inválidas');
    const overlap = await this.prisma.payrollPeriod.findFirst({ where: { companyId, startDate: { lte: end }, endDate: { gte: start } } });
    if (overlap) throw new BadRequestException(`Se cruza con el periodo ${overlap.label}`);
    const period = await this.prisma.payrollPeriod.create({
      data: { companyId, label: dto.label, startDate: start, endDate: end, payDate: pay, budget: dto.budget === undefined ? null : BigInt(dto.budget) },
    });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'PayrollPeriod', entityId: period.id, action: 'CREATED', data: { label: dto.label } });
    return { ...period, budget: dto.budget ?? null };
  }

  // Finance is read-only: only the company admin sets the budget.
  @Roles(...ADMIN) @Patch('periods/:id/budget')
  async budget(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: BudgetDto) {
    const companyId = requireCompany(u);
    const r = await this.prisma.payrollPeriod.updateMany({ where: { id, companyId }, data: { budget: BigInt(dto.budget) } });
    if (!r.count) throw new NotFoundException('Periodo no encontrado');
    await this.audit.log({ actorId: u.sub, companyId, entity: 'PayrollPeriod', entityId: id, action: 'BUDGET_SET', data: { budget: dto.budget } });
    return { ok: true };
  }

  @Roles(...COMPANY) @Get('periods/:id')
  async period(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const companyId = requireCompany(u);
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, companyId },
      include: {
        entries: { include: { worker: { select: { firstName: true, lastName: true, docNumber: true } } } },
        uploads: { orderBy: { createdAt: 'desc' } },
        novelties: { include: { worker: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    return { ...period, budget: period.budget === null ? null : Number(period.budget) };
  }

  // Manual correction of one worker's payroll data, keeping the trace.
  @Roles(...ADMIN) @Patch('periods/:id/entries/:workerId')
  async entry(@CurrentUser() u: AuthUser, @Param('id') periodId: string, @Param('workerId') workerId: string, @Body() dto: EntryDto) {
    const companyId = requireCompany(u);
    const [period, worker] = await Promise.all([
      this.prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId } }),
      this.prisma.worker.findFirst({ where: { id: workerId, companyId } }),
    ]);
    if (!period || !worker) throw new NotFoundException('Periodo o trabajador no encontrado');
    if (period.status !== 'OPEN') throw new BadRequestException('El periodo está cerrado');
    const before = await this.prisma.payrollEntry.findUnique({ where: { periodId_workerId: { periodId, workerId } } });
    const entry = await this.prisma.payrollEntry.upsert({
      where: { periodId_workerId: { periodId, workerId } },
      create: { periodId, workerId, baseSalary: dto.baseSalary ?? worker.baseSalary, ...dto },
      update: dto,
    });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'PayrollEntry', entityId: entry.id, action: 'CORRECTED', data: { before, after: dto } });
    return entry;
  }

  // File upload: CSV with documento,salario,dias_trabajados,horas_extra,valor_horas_extra,recargos,deducciones
  @Roles(...ADMIN) @Post('periods/:id/upload')
  @UseInterceptors(FileInterceptor('file', csvUpload))
  upload(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file?: { buffer: Buffer; originalname: string }) {
    if (!file) throw new BadRequestException('Adjunta un archivo CSV en el campo "file"');
    return this.payroll.ingest(requireCompany(u), id, parseCsv(file.buffer.toString('utf8')), 'FILE', file.originalname, u.sub);
  }

  // ERP integration: the payroll system pushes data with the company's API key.
  @Public() @Post('erp/sync')
  async erp(@Headers('x-api-key') apiKey: string | undefined, @Body() dto: ErpSyncDto) {
    if (!apiKey) throw new UnauthorizedException('x-api-key requerido');
    const company = await this.prisma.company.findUnique({ where: { apiKey } });
    if (!company) throw new UnauthorizedException('API key inválida');
    const period =
      (dto.periodId && (await this.prisma.payrollPeriod.findFirst({ where: { id: dto.periodId, companyId: company.id } }))) ||
      (await this.prisma.payrollPeriod.findFirst({ where: { companyId: company.id, status: 'OPEN' }, orderBy: { startDate: 'desc' } }));
    if (!period) throw new BadRequestException('No hay periodo abierto');
    const rows = dto.entries.map((e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k.toLowerCase(), v])));
    return this.payroll.ingest(company.id, period.id, rows, 'ERP_API', `${company.erpName ?? 'ERP'} ${new Date().toISOString()}`);
  }

  @Roles(...ADMIN) @Post('integration/api-key')
  async rotateKey(@CurrentUser() u: AuthUser, @Body() dto: RotateKeyDto) {
    const companyId = requireCompany(u);
    const apiKey = `flx_${randomBytes(24).toString('hex')}`;
    await this.prisma.company.update({ where: { id: companyId }, data: { apiKey, integrationType: 'ERP_API', erpName: dto.erpName } });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Company', entityId: companyId, action: 'API_KEY_ROTATED' });
    return { apiKey, note: 'Guárdala ahora; no se volverá a mostrar.' };
  }

  @Roles(...COMPANY) @Get('uploads')
  uploads(@CurrentUser() u: AuthUser) {
    return this.prisma.payrollUpload.findMany({
      where: { companyId: requireCompany(u) },
      include: { period: { select: { label: true } }, _count: { select: { issues: { where: { resolved: false } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(...COMPANY) @Get('uploads/:id')
  async uploadDetail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const up = await this.prisma.payrollUpload.findFirst({
      where: { id, companyId: requireCompany(u) },
      include: { issues: { orderBy: { row: 'asc' } }, period: { select: { label: true } } },
    });
    if (!up) throw new NotFoundException('Carga no encontrada');
    return up;
  }

  @Roles(...ADMIN) @Patch('issues/:id/resolve')
  async resolveIssue(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const companyId = requireCompany(u);
    const r = await this.prisma.payrollIssue.updateMany({ where: { id, upload: { companyId } }, data: { resolved: true, resolvedAt: new Date() } });
    if (!r.count) throw new NotFoundException('Inconsistencia no encontrada');
    await this.audit.log({ actorId: u.sub, companyId, entity: 'PayrollIssue', entityId: id, action: 'RESOLVED' });
    return { ok: true };
  }

  @Roles(...COMPANY) @Get('novelties')
  novelties(@CurrentUser() u: AuthUser, @Query('periodId') periodId?: string, @Query('workerId') workerId?: string) {
    return this.prisma.payrollNovelty.findMany({
      where: { worker: { companyId: requireCompany(u) }, ...(periodId ? { periodId } : {}), ...(workerId ? { workerId } : {}) },
      include: { worker: { select: { firstName: true, lastName: true, docNumber: true } }, period: { select: { label: true } } },
      orderBy: { date: 'desc' },
    });
  }

  @Roles(...ADMIN) @Post('novelties')
  async addNovelty(@CurrentUser() u: AuthUser, @Body() dto: NoveltyDto) {
    const companyId = requireCompany(u);
    const worker = await this.prisma.worker.findFirst({ where: { id: dto.workerId, companyId } });
    if (!worker) throw new NotFoundException('Trabajador no encontrado');
    const period = dto.periodId
      ? await this.prisma.payrollPeriod.findFirst({ where: { id: dto.periodId, companyId } })
      : await this.prisma.payrollPeriod.findFirst({ where: { companyId, status: 'OPEN' }, orderBy: { startDate: 'desc' } });
    if (!period) throw new BadRequestException('No hay periodo abierto');
    const novelty = await this.prisma.payrollNovelty.create({
      data: { workerId: worker.id, periodId: period.id, type: dto.type, description: dto.description, days: dto.days ?? 0, amount: dto.amount ?? 0, date: dto.date ? new Date(dto.date) : new Date(), createdBy: u.sub },
    });
    // A retirement novelty disables access automatically.
    if (dto.type === 'RETIRO')
      await this.prisma.worker.update({ where: { id: worker.id }, data: { status: 'RETIRED', enabled: false, disabledReason: 'Retiro reportado en nómina' } });
    if (dto.type === 'AJUSTE_SALARIO' && dto.amount) await this.prisma.worker.update({ where: { id: worker.id }, data: { baseSalary: dto.amount } });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'PayrollNovelty', entityId: novelty.id, action: 'CREATED', data: dto });
    return novelty;
  }

  // Data quality of the current period: what's missing or inconsistent before it affects the available amount.
  @Roles(...COMPANY) @Get('status')
  async status(@CurrentUser() u: AuthUser) {
    const companyId = requireCompany(u);
    const period = await this.prisma.payrollPeriod.findFirst({ where: { companyId, status: 'OPEN' }, orderBy: { startDate: 'desc' } });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    if (!period) return { period: null, problems: ['No hay un periodo de nómina abierto'] };
    const [workers, entries, lastUpload, openIssues] = await Promise.all([
      this.prisma.worker.findMany({ where: { companyId, enabled: true, status: { not: 'RETIRED' } } }),
      this.prisma.payrollEntry.findMany({ where: { periodId: period.id } }),
      this.prisma.payrollUpload.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payrollIssue.count({ where: { upload: { companyId }, resolved: false, severity: 'ERROR' } }),
    ]);
    const withEntry = new Set(entries.map((e) => e.workerId));
    const missing = workers.filter((w) => !withEntry.has(w.id));
    const staleDays = lastUpload ? Math.floor((Date.now() - +lastUpload.createdAt) / 86_400_000) : null;
    const problems: string[] = [];
    if (missing.length) problems.push(`${missing.length} trabajadores habilitados sin información de nómina en ${period.label}`);
    if (openIssues) problems.push(`${openIssues} inconsistencias sin resolver`);
    if (staleDays === null || staleDays > 15) problems.push('La información de nómina no se ha actualizado en los últimos 15 días');
    return {
      period: { id: period.id, label: period.label, startDate: period.startDate, endDate: period.endDate, payDate: period.payDate },
      integration: { type: company.integrationType, status: company.integrationStatus, erpName: company.erpName, lastSyncAt: company.lastSyncAt },
      coveragePct: workers.length ? Math.round(((workers.length - missing.length) / workers.length) * 100) : 100,
      missingWorkers: missing.map((w) => ({ id: w.id, name: `${w.firstName} ${w.lastName}`, docNumber: w.docNumber })),
      openIssues,
      lastUpload,
      problems,
      ready: problems.length === 0,
    };
  }
}
