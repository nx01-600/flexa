import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsArray, IsBoolean, IsDefined, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, Roles, requireCompany } from '../common/auth.js';
import { INT_MAX, csvUpload, parseAmount, parseCsv, sum, toCsv } from '../common/util.js';

class LineFixDto {
  @Type(() => Number) @IsInt() @Min(0) compensatedAmount: number;
  @IsString() @MinLength(3) note: string;
}
class AppliedItemDto {
  @Type(() => String) @IsString() docNumber: string;
  // Number or text such as "1.500.000"; parsed by parseAmount in the handler.
  @IsDefined() amount: number | string;
}
class AppliedDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AppliedItemDto) items?: AppliedItemDto[];
}
class ReconcileDto {
  @IsOptional() @IsBoolean() force?: boolean;
  @IsOptional() @IsString() note?: string;
}

const ADMIN = ['COMPANY_ADMIN'] as const;
const COMPANY = ['COMPANY_ADMIN', 'COMPANY_FINANCE'] as const;

// Módulo 8: closes the loop. Every advance is consolidated per worker, compensated in payroll
// and compared with what was disbursed.
@Controller('compensation')
export class CompensationController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async period(companyId: string, id: string) {
    const p = await this.prisma.payrollPeriod.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Periodo no encontrado');
    return p;
  }

  // Values pending compensation across all periods not yet reconciled.
  @Roles(...COMPANY) @Get('pending')
  async pending(@CurrentUser() u: AuthUser) {
    const companyId = requireCompany(u);
    const open = await this.prisma.advance.groupBy({
      by: ['periodId'],
      where: { status: 'DISBURSED', period: { companyId, status: { in: ['OPEN', 'CLOSED'] } } },
      _sum: { amount: true, fee: true },
      _count: true,
    });
    const paid = await this.prisma.servicePayment.groupBy({
      by: ['periodId'],
      where: { status: 'COMPLETED', worker: { companyId }, periodId: { in: open.map((o) => o.periodId) } },
      _sum: { amount: true },
    });
    const lines = await this.prisma.compensationLine.findMany({
      where: { period: { companyId }, status: { in: ['PENDING', 'PARTIAL', 'DIFFERENCE'] } },
      include: { period: { select: { label: true } }, worker: { select: { firstName: true, lastName: true, docNumber: true } } },
    });
    const periods = await this.prisma.payrollPeriod.findMany({ where: { id: { in: open.map((o) => o.periodId) } } });
    return {
      byPeriod: open.map((o) => ({
        periodId: o.periodId,
        label: periods.find((p) => p.id === o.periodId)?.label,
        status: periods.find((p) => p.id === o.periodId)?.status,
        advances: o._count,
        toCompensate: (o._sum.amount ?? 0) + (o._sum.fee ?? 0) + (paid.find((p) => p.periodId === o.periodId)?._sum.amount ?? 0),
      })),
      openLines: lines,
      totalPending: sum(lines, (l) => l.toCompensate - l.compensatedAmount),
    };
  }

  // Closing a period consolidates its advances into compensation lines.
  @Roles(...ADMIN) @Post('periods/:id/close')
  async close(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const companyId = requireCompany(u);
    await this.period(companyId, id);

    await this.prisma.$transaction(async (tx) => {
      // Row lock: advance retry() reads the period FOR SHARE, so a retry and a close cannot interleave.
      const [locked] = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "PayrollPeriod" WHERE id = ${id} FOR UPDATE`;
      if (locked?.status !== 'OPEN') throw new BadRequestException('El periodo ya fue cerrado');
      const inFlight = await tx.advance.count({ where: { periodId: id, status: { in: ['REQUESTED', 'APPROVED', 'DISBURSING', 'EXCEPTION'] } } });
      if (inFlight) throw new BadRequestException(`Hay ${inFlight} solicitudes sin terminar. Resuélvelas antes de cerrar.`);

      const [advances, payments] = await Promise.all([
        tx.advance.findMany({ where: { periodId: id, status: 'DISBURSED' } }),
        tx.servicePayment.findMany({ where: { periodId: id, status: 'COMPLETED' } }),
      ]);
      const byWorker = new Map<string, { count: number; amount: number; fees: number }>();
      for (const a of advances) {
        const cur = byWorker.get(a.workerId) ?? { count: 0, amount: 0, fees: 0 };
        byWorker.set(a.workerId, { count: cur.count + 1, amount: cur.amount + a.amount, fees: cur.fees + a.fee });
      }
      for (const p of payments) {
        const cur = byWorker.get(p.workerId) ?? { count: 0, amount: 0, fees: 0 };
        byWorker.set(p.workerId, { count: cur.count + 1, amount: cur.amount + p.amount, fees: cur.fees });
      }

      for (const [workerId, t] of byWorker) {
        await tx.compensationLine.upsert({
          where: { periodId_workerId: { periodId: id, workerId } },
          create: { periodId: id, workerId, advancesCount: t.count, advancedTotal: t.amount, feesTotal: t.fees, toCompensate: t.amount + t.fees, difference: t.amount + t.fees },
          update: { advancesCount: t.count, advancedTotal: t.amount, feesTotal: t.fees, toCompensate: t.amount + t.fees, compensatedAmount: 0, difference: t.amount + t.fees, status: 'PENDING', note: null },
        });
      }
      const total = sum([...byWorker.values()], (t) => t.amount + t.fees);
      await tx.payrollPeriod.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await tx.reconciliation.upsert({
        where: { periodId: id },
        create: { companyId, periodId: id, status: byWorker.size ? 'IN_PROGRESS' : 'RECONCILED', disbursedTotal: total, differenceTotal: total },
        update: { disbursedTotal: total, compensatedTotal: 0, differenceTotal: total, status: 'IN_PROGRESS', closedAt: null, closedBy: null },
      });
      await this.audit.log({ actorId: u.sub, companyId, entity: 'PayrollPeriod', entityId: id, action: 'CLOSED', data: { workers: byWorker.size, total } }, tx);
    });
    return this.detail(u, id);
  }

  @Roles(...COMPANY) @Get('periods/:id')
  async detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const companyId = requireCompany(u);
    const period = await this.period(companyId, id);
    const [lines, reconciliation] = await Promise.all([
      this.prisma.compensationLine.findMany({
        where: { periodId: id },
        include: { worker: { select: { firstName: true, lastName: true, docNumber: true, site: { select: { name: true } } } } },
        orderBy: { toCompensate: 'desc' },
      }),
      this.prisma.reconciliation.findUnique({ where: { periodId: id } }),
    ]);
    return {
      period: { ...period, budget: period.budget === null ? null : Number(period.budget) },
      reconciliation,
      totals: {
        workers: lines.length,
        toCompensate: sum(lines, (l) => l.toCompensate),
        compensated: sum(lines, (l) => l.compensatedAmount),
        difference: sum(lines, (l) => l.difference),
        absoluteDifference: sum(lines, (l) => Math.abs(l.difference)),
        withDifferences: lines.filter((l) => l.status === 'DIFFERENCE' || l.status === 'PARTIAL').length,
      },
      lines,
    };
  }

  // File the company loads into its payroll system to apply the deductions.
  @Roles(...COMPANY) @Get('periods/:id/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="compensacion-flexa.csv"')
  async export(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const d = await this.detail(u, id);
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'PayrollPeriod', entityId: id, action: 'COMPENSATION_EXPORTED' });
    return toCsv(
      d.lines.map((l) => ({
        documento: l.worker.docNumber,
        nombre: `${l.worker.firstName} ${l.worker.lastName}`,
        concepto: 'ANTICIPO SALARIAL FLEXA',
        operaciones: l.advancesCount,
        valor_anticipado: l.advancedTotal,
        comisiones: l.feesTotal,
        valor_a_descontar: l.toCompensate,
      })),
    );
  }

  // The company reports what was actually deducted: JSON body or CSV (documento,valor_descontado).
  @Roles(...ADMIN) @Post('periods/:id/applied')
  @UseInterceptors(FileInterceptor('file', csvUpload))
  async applied(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: AppliedDto,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    const companyId = requireCompany(u);
    const period = await this.period(companyId, id);
    if (period.status === 'OPEN') throw new BadRequestException('Cierra el periodo antes de conciliar');
    if (period.status === 'RECONCILED') throw new BadRequestException('El periodo ya está conciliado');
    const reportedItems =
      body.items ??
      (file
        ? parseCsv(file.buffer.toString('utf8')).map((r) => ({
            docNumber: r.documento ?? r.doc ?? '',
            // A blank cell means nothing was deducted.
            amount: r.valor_descontado || r.valor || r.amount || '0',
          }))
        : []);
    if (!reportedItems.length) throw new BadRequestException('Envía los valores descontados');
    // Amounts keep their sign; one unreadable value rejects the whole report instead of reconciling on a guess.
    const items = reportedItems.map((i) => {
      const amount = parseAmount(i.amount);
      if (amount === null || Math.abs(amount) > INT_MAX) throw new BadRequestException(`Valor descontado inválido para el documento ${i.docNumber}`);
      return { docNumber: i.docNumber, amount };
    });

    const lines = await this.prisma.compensationLine.findMany({ where: { periodId: id }, include: { worker: true } });
    // Lines the company doesn't report go back to pending with their full value as difference.
    const reported = new Set(items.map((i) => String(i.docNumber).replace(/\D/g, '')));
    for (const l of lines.filter((l) => !reported.has(l.worker.docNumber.replace(/\D/g, ''))))
      await this.prisma.compensationLine.update({ where: { id: l.id }, data: { compensatedAmount: 0, difference: l.toCompensate, status: 'PENDING' } });
    const unknown: string[] = [];
    for (const item of items) {
      const line = lines.find((l) => l.worker.docNumber.replace(/\D/g, '') === String(item.docNumber).replace(/\D/g, ''));
      if (!line) {
        unknown.push(item.docNumber);
        continue;
      }
      const difference = line.toCompensate - item.amount;
      await this.prisma.compensationLine.update({
        where: { id: line.id },
        data: { compensatedAmount: item.amount, difference, status: difference === 0 ? 'APPLIED' : item.amount === 0 ? 'PENDING' : difference > 0 ? 'PARTIAL' : 'DIFFERENCE' },
      });
    }
    const reconciliation = await this.refresh(companyId, id);
    if (reconciliation.absoluteDifference !== 0)
      await this.prisma.incident.create({
        data: { companyId, category: 'RECONCILIATION', title: `Diferencias en la conciliación de ${period.label}`, description: `Diferencia absoluta $${reconciliation.absoluteDifference.toLocaleString('es-CO')} (neto $${reconciliation.differenceTotal.toLocaleString('es-CO')})` },
      });
    await this.prisma.payrollPeriod.update({ where: { id }, data: { status: 'COMPENSATED' } });
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Reconciliation', entityId: reconciliation.id, action: 'COMPENSATION_REPORTED', data: { items: items.length, unknown } });
    return { reconciliation, unknownDocuments: unknown };
  }

  // Resolve a reconciliation exception for one worker.
  @Roles(...ADMIN) @Patch('lines/:id')
  async fixLine(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: LineFixDto) {
    const companyId = requireCompany(u);
    const line = await this.prisma.compensationLine.findFirst({ where: { id, period: { companyId } }, include: { period: true } });
    if (!line) throw new NotFoundException('Línea no encontrada');
    if (line.period.status === 'RECONCILED') throw new BadRequestException('El periodo ya está conciliado');
    const difference = line.toCompensate - dto.compensatedAmount;
    const updated = await this.prisma.compensationLine.update({
      where: { id },
      data: { compensatedAmount: dto.compensatedAmount, difference, note: dto.note, status: difference === 0 ? 'APPLIED' : difference > 0 ? 'PARTIAL' : 'DIFFERENCE' },
    });
    await this.refresh(companyId, line.periodId);
    await this.audit.log({ actorId: u.sub, companyId, entity: 'CompensationLine', entityId: id, action: 'ADJUSTED', data: { before: line.compensatedAmount, after: dto.compensatedAmount, note: dto.note } });
    return updated;
  }

  @Roles(...ADMIN) @Post('periods/:id/reconcile')
  async reconcile(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReconcileDto) {
    const companyId = requireCompany(u);
    const period = await this.period(companyId, id);
    if (period.status === 'OPEN') throw new BadRequestException('Cierra el periodo antes de conciliar');
    const rec = await this.refresh(companyId, id);
    if (rec.absoluteDifference !== 0 && !dto.force)
      throw new BadRequestException(`Quedan diferencias por $${rec.absoluteDifference.toLocaleString('es-CO')}. Resuélvelas o fuerza el cierre con una nota.`);
    if (dto.force && !dto.note) throw new BadRequestException('Explica por qué cierras con diferencias');
    await this.prisma.$transaction([
      this.prisma.reconciliation.update({ where: { periodId: id }, data: { status: 'RECONCILED', closedAt: new Date(), closedBy: u.sub } }),
      this.prisma.payrollPeriod.update({ where: { id }, data: { status: 'RECONCILED' } }),
      this.prisma.incident.updateMany({
        where: { companyId, category: 'RECONCILIATION', status: { not: 'RESOLVED' }, title: { contains: period.label } },
        data: { status: 'RESOLVED', resolution: dto.note ?? 'Conciliación cerrada sin diferencias', resolvedById: u.sub, resolvedAt: new Date() },
      }),
    ]);
    await this.audit.log({ actorId: u.sub, companyId, entity: 'Reconciliation', entityId: rec.id, action: 'RECONCILED', data: { differenceTotal: rec.differenceTotal, absoluteDifference: rec.absoluteDifference, note: dto.note } });
    return this.detail(u, id);
  }

  @Roles(...COMPANY) @Get('periods/:id/report')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="conciliacion-flexa.csv"')
  async report(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const d = await this.detail(u, id);
    return toCsv(
      d.lines.map((l) => ({
        periodo: d.period.label,
        documento: l.worker.docNumber,
        nombre: `${l.worker.firstName} ${l.worker.lastName}`,
        sede: l.worker.site?.name ?? '',
        desembolsado: l.advancedTotal,
        comisiones: l.feesTotal,
        a_compensar: l.toCompensate,
        compensado: l.compensatedAmount,
        diferencia: l.difference,
        estado: l.status,
        nota: l.note ?? '',
      })),
    );
  }

  @Roles(...COMPANY) @Get('reconciliations')
  reconciliations(@CurrentUser() u: AuthUser) {
    return this.prisma.reconciliation.findMany({
      where: { companyId: requireCompany(u) },
      include: { period: { select: { label: true, startDate: true, payDate: true } } },
      orderBy: { period: { startDate: 'desc' } },
    });
  }

  private async refresh(companyId: string, periodId: string) {
    const lines = await this.prisma.compensationLine.findMany({ where: { periodId } });
    const disbursedTotal = sum(lines, (l) => l.toCompensate);
    const compensatedTotal = sum(lines, (l) => l.compensatedAmount);
    // Net for display; pass/fail uses the sum of per-line gaps so opposite-sign differences cannot cancel out.
    const differenceTotal = disbursedTotal - compensatedTotal;
    const absoluteDifference = sum(lines, (l) => Math.abs(l.toCompensate - l.compensatedAmount));
    const status = absoluteDifference ? 'WITH_DIFFERENCES' : 'IN_PROGRESS';
    const rec = await this.prisma.reconciliation.upsert({
      where: { periodId },
      create: { companyId, periodId, disbursedTotal, compensatedTotal, differenceTotal, status },
      update: { disbursedTotal, compensatedTotal, differenceTotal, status },
    });
    return { ...rec, absoluteDifference };
  }
}
