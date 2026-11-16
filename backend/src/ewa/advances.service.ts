import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService, type Tx } from '../common/audit.service.js';
import { FundingProvider, PaymentsProvider } from '../common/providers.js';
import { code } from '../common/util.js';
import { EarningsService, type Snapshot } from './earnings.service.js';
import type { AdvanceStatus } from '../generated/prisma/enums.js';

// Módulos 3, 4 y 7: request lifecycle, automatic flow, exceptions and Alarma FLEXA.
@Injectable()
export class AdvancesService {
  constructor(
    private prisma: PrismaService,
    private earnings: EarningsService,
    private audit: AuditService,
    private payments: PaymentsProvider,
    private funding: FundingProvider,
  ) {}

  private event(tx: Tx, advanceId: string, status: AdvanceStatus, note?: string, actor = 'SYSTEM') {
    return tx.advanceEvent.create({ data: { advanceId, status, note, actor } });
  }

  async request(
    workerId: string,
    userId: string,
    input: { amount: number; bankAccountId?: string; acknowledgeWarnings?: boolean },
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      // Serialize requests of the same worker so two concurrent requests can't exceed the available.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workerId}))`;
      const snap = await this.earnings.snapshot(workerId, tx);
      const sim = this.earnings.simulate(snap, input.amount);
      if (!sim.valid) throw new BadRequestException({ message: sim.errors[0], errors: sim.errors });
      if (sim.requiresAcknowledgement && !input.acknowledgeWarnings) {
        throw new ConflictException({
          message: 'Debes confirmar que leíste las advertencias',
          warnings: sim.warnings,
          code: 'ACK_REQUIRED',
        });
      }

      const account =
        snap.worker.accounts.find((a) => a.id === input.bankAccountId) ??
        (input.bankAccountId ? null : (snap.worker.accounts.find((a) => a.isDefault) ?? snap.worker.accounts[0]));
      if (!account) throw new BadRequestException('Cuenta de destino no válida');

      const isException = input.amount >= snap.settings.exceptionAmount;
      const advance = await tx.advance.create({
        data: {
          code: code('FX'),
          workerId,
          periodId: snap.period!.id,
          bankAccountId: account.id,
          amount: input.amount,
          fee: sim.fee,
          netAmount: input.amount,
          status: isException ? 'EXCEPTION' : 'APPROVED',
          availableAtRequest: snap.available,
          recommendedAtRequest: snap.recommended,
          overRecommended: sim.overRecommended,
          warningAcknowledged: !!input.acknowledgeWarnings,
          exceptionReason: isException ? 'Monto igual o superior al umbral de revisión de la empresa' : null,
        },
      });
      await this.event(tx, advance.id, 'REQUESTED', 'Solicitud creada por el trabajador', userId);
      if (isException) {
        await this.event(tx, advance.id, 'EXCEPTION', advance.exceptionReason!);
        await tx.incident.create({
          data: {
            companyId: snap.worker.companyId,
            workerId,
            advanceId: advance.id,
            category: 'ADVANCE_EXCEPTION',
            title: `Solicitud ${advance.code} requiere revisión`,
            description: advance.exceptionReason!,
          },
        });
      } else {
        await this.event(tx, advance.id, 'APPROVED', 'Cumple las reglas: aprobación automática');
      }
      await this.audit.log(
        {
          actorId: userId,
          companyId: snap.worker.companyId,
          entity: 'Advance',
          entityId: advance.id,
          action: 'REQUESTED',
          data: { amount: input.amount, available: snap.available, recommended: snap.recommended },
        },
        tx,
      );
      await this.evaluateAlarms(tx, snap, input.amount + sim.fee, sim.overRecommended);
      return advance;
    });

    if (created.status === 'APPROVED') return this.disburse(created.id);
    return this.detail(created.id);
  }

  // Funding partner reserves liquidity, payments provider moves the money.
  async disburse(advanceId: string, actor = 'SYSTEM') {
    const advance = await this.prisma.advance.findUnique({
      where: { id: advanceId },
      include: { bankAccount: true, worker: true },
    });
    if (!advance) throw new NotFoundException('Solicitud no encontrada');
    if (advance.status !== 'APPROVED') throw new BadRequestException('La solicitud no está aprobada');

    await this.prisma.advance.update({ where: { id: advanceId }, data: { status: 'DISBURSING' } });
    await this.event(this.prisma, advanceId, 'DISBURSING', 'Enviando al proveedor de pagos', actor);

    const funding = this.funding.reserve(advance.amount);
    const transfer = funding.ok
      ? this.payments.transfer({ bank: advance.bankAccount.bank, account: advance.bankAccount.number, amount: advance.netAmount })
      : ({ ok: false, error: 'El aliado de fondeo no confirmó la liquidez' } as const);

    await this.prisma.$transaction(async (tx) => {
      if (transfer.ok) {
        await tx.advance.update({
          where: { id: advanceId },
          data: { status: 'DISBURSED', disbursedAt: new Date(), providerRef: transfer.ref, fundingRef: funding.ref },
        });
        await this.event(tx, advanceId, 'DISBURSED', `Transferencia ${transfer.ref}`);
        await tx.alert.create({
          data: {
            workerId: advance.workerId,
            type: 'DISBURSED',
            title: 'Desembolso realizado',
            message: `Enviamos $${advance.netAmount.toLocaleString('es-CO')} a tu cuenta ${advance.bankAccount.bank}.`,
          },
        });
        await tx.document.create({
          data: { workerId: advance.workerId, type: 'RECEIPT', title: `Comprobante ${advance.code}`, refId: advanceId },
        });
      } else {
        await tx.advance.update({ where: { id: advanceId }, data: { status: 'FAILED', fundingRef: funding.ref } });
        await this.event(tx, advanceId, 'FAILED', transfer.error);
        await tx.incident.create({
          data: {
            companyId: advance.worker.companyId,
            workerId: advance.workerId,
            advanceId,
            category: 'DISBURSEMENT_FAILED',
            title: `Falló el desembolso ${advance.code}`,
            description: transfer.error,
          },
        });
        await tx.alert.create({
          data: {
            workerId: advance.workerId,
            type: 'DISBURSEMENT_FAILED',
            level: 'WARNING',
            title: 'No pudimos enviar tu dinero',
            message: 'El monto vuelve a tu disponible. Revisa tu cuenta de destino o contacta soporte.',
          },
        });
      }
      await this.audit.log(
        {
          companyId: advance.worker.companyId,
          entity: 'Advance',
          entityId: advanceId,
          action: transfer.ok ? 'DISBURSED' : 'DISBURSEMENT_FAILED',
        },
        tx,
      );
    });
    return this.detail(advanceId);
  }

  // Módulo 7: the company resolves an exception (approve -> automatic disbursement, or reject).
  async resolveException(companyId: string, advanceId: string, userId: string, approve: boolean, note: string) {
    const advance = await this.prisma.advance.findFirst({ where: { id: advanceId, worker: { companyId } } });
    if (!advance) throw new NotFoundException('Solicitud no encontrada');
    if (advance.status !== 'EXCEPTION') throw new BadRequestException('La solicitud no está en excepción');

    await this.prisma.$transaction(async (tx) => {
      await tx.advance.update({ where: { id: advanceId }, data: { status: approve ? 'APPROVED' : 'REJECTED' } });
      await this.event(tx, advanceId, approve ? 'APPROVED' : 'REJECTED', note, userId);
      await tx.incident.updateMany({
        where: { advanceId, status: { not: 'RESOLVED' } },
        data: { status: 'RESOLVED', resolution: note, resolvedById: userId, resolvedAt: new Date() },
      });
      if (!approve) {
        await tx.alert.create({
          data: {
            workerId: advance.workerId,
            type: 'REJECTED',
            level: 'WARNING',
            title: 'Solicitud no aprobada',
            message: `Tu solicitud ${advance.code} no fue aprobada: ${note}`,
          },
        });
      }
      await this.audit.log(
        { actorId: userId, companyId, entity: 'Advance', entityId: advanceId, action: approve ? 'EXCEPTION_APPROVED' : 'EXCEPTION_REJECTED', data: { note } },
        tx,
      );
    });
    return approve ? this.disburse(advanceId, userId) : this.detail(advanceId);
  }

  // A failed disbursement can be retried (e.g. after the worker fixed the account).
  async retry(companyId: string | null, advanceId: string, userId: string) {
    const advance = await this.prisma.advance.findFirst({
      where: { id: advanceId, ...(companyId ? { worker: { companyId } } : {}) },
    });
    if (!advance || advance.status !== 'FAILED') throw new BadRequestException('Solo se reintentan desembolsos fallidos');
    await this.prisma.advance.update({ where: { id: advanceId }, data: { status: 'APPROVED' } });
    await this.event(this.prisma, advanceId, 'APPROVED', 'Reintento de desembolso', userId);
    return this.disburse(advanceId, userId);
  }

  async cancel(workerId: string, advanceId: string, userId: string) {
    const advance = await this.prisma.advance.findFirst({ where: { id: advanceId, workerId } });
    if (!advance) throw new NotFoundException('Solicitud no encontrada');
    if (!['REQUESTED', 'EXCEPTION'].includes(advance.status))
      throw new BadRequestException('Esta solicitud ya no se puede cancelar');
    await this.prisma.$transaction([
      this.prisma.advance.update({ where: { id: advanceId }, data: { status: 'CANCELLED' } }),
      this.prisma.advanceEvent.create({ data: { advanceId, status: 'CANCELLED', note: 'Cancelada por el trabajador', actor: userId } }),
      this.prisma.incident.updateMany({
        where: { advanceId, status: { not: 'RESOLVED' } },
        data: { status: 'RESOLVED', resolution: 'El trabajador canceló la solicitud', resolvedAt: new Date() },
      }),
    ]);
    return this.detail(advanceId);
  }

  detail(id: string) {
    return this.prisma.advance.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        bankAccount: { select: { bank: true, number: true, type: true } },
        worker: { select: { firstName: true, lastName: true, docNumber: true } },
        period: { select: { label: true, payDate: true } },
      },
    });
  }

  // Módulo 4: Alarma FLEXA. Informs, never blocks.
  private async evaluateAlarms(tx: Tx, snap: Snapshot, addedUse: number, overRecommended: boolean) {
    const { settings, worker } = snap;
    const usedAfter = snap.used + addedUse;
    const usagePct = snap.limit ? Math.round((usedAfter / snap.limit) * 100) : 0;
    const count = snap.requestsCount + 1;
    const alerts: { type: string; level: 'INFO' | 'WARNING' | 'CRITICAL'; title: string; message: string }[] = [];
    if (usagePct >= settings.alarmUsagePct)
      alerts.push({
        type: 'USAGE_THRESHOLD',
        level: usagePct >= 90 ? 'CRITICAL' : 'WARNING',
        title: 'Alarma FLEXA: uso alto',
        message: `Has usado el ${usagePct} % de tu tope del periodo. Tu próximo pago será de aprox. $${(snap.nextPayAfterUsage - addedUse).toLocaleString('es-CO')}.`,
      });
    if (count >= settings.alarmRequestsCount)
      alerts.push({
        type: 'REQUEST_COUNT',
        level: 'WARNING',
        title: 'Alarma FLEXA: retiros frecuentes',
        message: `Llevas ${count} retiros en este periodo. Revisa si puedes cubrir tus gastos con tu próximo pago.`,
      });
    if (overRecommended)
      alerts.push({
        type: 'OVER_RECOMMENDED',
        level: 'INFO',
        title: 'Retiraste más del recomendado',
        message: 'El recomendado protege tu siguiente pago. Intenta mantenerte por debajo en tus próximos retiros.',
      });
    if (alerts.length) await tx.alert.createMany({ data: alerts.map((a) => ({ ...a, workerId: worker.id })) });
  }
}
