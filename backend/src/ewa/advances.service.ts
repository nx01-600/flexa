import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService, type Tx } from '../common/audit.service.js';
import { FundingProvider, PaymentsProvider } from '../common/providers.js';
import { code } from '../common/util.js';
import { type BlockerCode, EarningsService, type Snapshot } from './earnings.service.js';
import type { AdvanceStatus } from '../generated/prisma/enums.js';

// Blockers that stop a FAILED advance from being paid on retry. Blackout, consents and the request cap
// applied when it was first requested, so they do not apply again.
const RETRY_BLOCKERS: BlockerCode[] = ['COMPANY_SUSPENDED', 'WORKER_DISABLED', 'KYC', 'ACCOUNT', 'NO_PERIOD'];

// Módulos 3, 4 y 7: request lifecycle, automatic flow, exceptions and Alarma FLEXA.
@Injectable()
export class AdvancesService {
  private log = new Logger('AdvancesService');

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

  // Status-guarded write: only the caller that still sees `from` wins, so concurrent
  // approvals, retries or cancels can't both move the same advance.
  private async transition(
    tx: Tx,
    id: string,
    from: AdvanceStatus | AdvanceStatus[],
    data: { status: AdvanceStatus; disbursedAt?: Date; providerRef?: string; fundingRef?: string },
  ) {
    const { count } = await tx.advance.updateMany({
      where: { id, status: Array.isArray(from) ? { in: from } : from },
      data,
    });
    if (count !== 1) throw new ConflictException('La solicitud cambió de estado. Actualiza e intenta de nuevo.');
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
      // Same shared period lock as retry(): a request cannot land in a period that close() is closing.
      const [period] = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "PayrollPeriod" WHERE id = ${snap.period!.id} FOR SHARE`;
      if (period?.status !== 'OPEN') throw new BadRequestException('El periodo de nómina ya no está abierto');
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

    if (created.status !== 'APPROVED') return this.detail(created.id);
    return this.disburseOrFail(created.id);
  }

  // Used right after an advance is committed as APPROVED (request, exception approval, retry).
  private async disburseOrFail(advanceId: string, actor?: string) {
    try {
      return await this.disburse(advanceId, actor);
    } catch (e) {
      // The advance exists: report its real state instead of a raw 500, and never leave it APPROVED unattended
      // (no endpoint moves an APPROVED advance, and close() would wait on it forever).
      this.log.error(`disburse ${advanceId} failed: ${String(e)}`);
      await this.prisma
        .$transaction(async (tx) => {
          await this.transition(tx, advanceId, 'APPROVED', { status: 'FAILED' });
          await this.event(tx, advanceId, 'FAILED', 'No se pudo iniciar el desembolso');
        })
        .catch(() => undefined);
      return this.detail(advanceId);
    }
  }

  // Funding partner reserves liquidity, payments provider moves the money.
  async disburse(advanceId: string, actor = 'SYSTEM') {
    const advance = await this.prisma.advance.findUnique({
      where: { id: advanceId },
      include: { bankAccount: true, worker: true },
    });
    if (!advance) throw new NotFoundException('Solicitud no encontrada');
    if (advance.status !== 'APPROVED') throw new BadRequestException('La solicitud no está aprobada');

    // A lost race throws here (409) before any money moves.
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, advanceId, 'APPROVED', { status: 'DISBURSING' });
      await this.event(tx, advanceId, 'DISBURSING', 'Enviando al proveedor de pagos', actor);
    });

    let funding: { ok: boolean; ref: string } | null = null;
    let transfer: { ok: true; ref: string } | { ok: false; error: string };
    try {
      funding = this.funding.reserve(advance.amount);
      transfer = funding.ok
        ? this.payments.transfer({ bank: advance.bankAccount.bank, account: advance.bankAccount.number, amount: advance.netAmount })
        : { ok: false, error: 'El aliado de fondeo no confirmó la liquidez' };
    } catch (e) {
      // shortcut: sandbox providers are synchronous, so a throw means no money moved; a real async provider needs a status lookup here.
      this.log.error(`disburse ${advanceId} provider error: ${String(e)}`);
      transfer = { ok: false, error: 'Error del proveedor de pagos' };
    }
    const fundingRef = funding?.ref;

    try {
      await this.writeOutcome(advance, transfer, fundingRef);
    } catch (e) {
      this.log.error(`disburse ${advanceId} final write failed: ${String(e)}`);
      // Minimal guarded write so the advance never stays in DISBURSING. A transfer that went out is
      // recorded as DISBURSED, never FAILED: FAILED frees the amount and a retry would pay twice.
      await this.prisma
        .$transaction(async (tx) => {
          if (transfer.ok) {
            await this.transition(tx, advanceId, 'DISBURSING', { status: 'DISBURSED', disbursedAt: new Date(), providerRef: transfer.ref, fundingRef });
            await this.event(tx, advanceId, 'DISBURSED', `Transferencia ${transfer.ref}`);
          } else {
            await this.transition(tx, advanceId, 'DISBURSING', { status: 'FAILED', fundingRef });
            await this.event(tx, advanceId, 'FAILED', transfer.error);
          }
        })
        .catch((err) => this.log.error(`disburse ${advanceId} recovery failed: ${String(err)}`));
    }

    // The money did not go out: free the liquidity the funding partner reserved.
    if (!transfer.ok && funding?.ok) {
      try {
        this.funding.release(funding.ref);
      } catch (e) {
        this.log.error(`release ${funding.ref} failed: ${String(e)}`);
      }
    }
    return this.detail(advanceId);
  }

  private writeOutcome(
    advance: { id: string; code: string; workerId: string; netAmount: number; bankAccount: { bank: string }; worker: { companyId: string } },
    transfer: { ok: true; ref: string } | { ok: false; error: string },
    fundingRef?: string,
  ) {
    const advanceId = advance.id;
    return this.prisma.$transaction(async (tx) => {
      if (transfer.ok) {
        await this.transition(tx, advanceId, 'DISBURSING', {
          status: 'DISBURSED',
          disbursedAt: new Date(),
          providerRef: transfer.ref,
          fundingRef,
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
        await this.transition(tx, advanceId, 'DISBURSING', { status: 'FAILED', fundingRef });
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
  }

  // Módulo 7: the company resolves an exception (approve -> automatic disbursement, or reject).
  async resolveException(companyId: string, advanceId: string, userId: string, approve: boolean, note: string) {
    const advance = await this.prisma.advance.findFirst({ where: { id: advanceId, worker: { companyId } } });
    if (!advance) throw new NotFoundException('Solicitud no encontrada');
    if (advance.status !== 'EXCEPTION') throw new BadRequestException('La solicitud no está en excepción');

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, advanceId, 'EXCEPTION', { status: approve ? 'APPROVED' : 'REJECTED' });
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
    return approve ? this.disburseOrFail(advanceId, userId) : this.detail(advanceId);
  }

  // A failed disbursement can be retried (e.g. after the worker fixed the account).
  async retry(companyId: string | null, advanceId: string, userId: string) {
    const advance = await this.prisma.advance.findFirst({
      where: { id: advanceId, ...(companyId ? { worker: { companyId } } : {}) },
    });
    if (!advance || advance.status !== 'FAILED') throw new BadRequestException('Solo se reintentan desembolsos fallidos');
    await this.prisma.$transaction(async (tx) => {
      // Same per-worker lock as request(): a FAILED advance no longer counts in the available,
      // so it must fit in it again before it is revived.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${advance.workerId}))`;
      // FOR SHARE: waits for a concurrent close() (FOR UPDATE) and then sees its CLOSED status.
      const [period] = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "PayrollPeriod" WHERE id = ${advance.periodId} FOR SHARE`;
      const snap = await this.earnings.snapshot(advance.workerId, tx);
      if (period?.status !== 'OPEN' || snap.period?.id !== advance.periodId)
        throw new BadRequestException('El periodo de nómina de esta solicitud ya no está abierto');
      // snapshot() keeps `available` even with blockers, so a disabled/retired worker or a suspended company is checked here.
      const blocker = snap.blockerDetails.find((b) => RETRY_BLOCKERS.includes(b.code));
      if (blocker) throw new BadRequestException(`No se puede reintentar: ${blocker.message}`);
      if (advance.amount + advance.fee > snap.available)
        throw new BadRequestException('El monto más la comisión supera el disponible actual del trabajador');
      await this.transition(tx, advanceId, 'FAILED', { status: 'APPROVED' });
      await this.event(tx, advanceId, 'APPROVED', 'Reintento de desembolso', userId);
    });
    return this.disburseOrFail(advanceId, userId);
  }

  async cancel(workerId: string, advanceId: string, userId: string) {
    const advance = await this.prisma.advance.findFirst({ where: { id: advanceId, workerId } });
    if (!advance) throw new NotFoundException('Solicitud no encontrada');
    if (!['REQUESTED', 'EXCEPTION'].includes(advance.status))
      throw new BadRequestException('Esta solicitud ya no se puede cancelar');
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, advanceId, ['REQUESTED', 'EXCEPTION'], { status: 'CANCELLED' });
      await tx.advanceEvent.create({ data: { advanceId, status: 'CANCELLED', note: 'Cancelada por el trabajador', actor: userId } });
      await tx.incident.updateMany({
        where: { advanceId, status: { not: 'RESOLVED' } },
        data: { status: 'RESOLVED', resolution: 'El trabajador canceló la solicitud', resolvedAt: new Date() },
      });
    });
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
