import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export type Tx = Prisma.TransactionClient | PrismaService;

// Traceability (módulos 6, 7, 8, 10): every relevant change leaves a record.
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(
    entry: {
      actorId?: string | null;
      companyId?: string | null;
      entity: string;
      entityId?: string | null;
      action: string;
      data?: unknown;
    },
    tx: Tx = this.prisma,
  ) {
    return tx.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        companyId: entry.companyId ?? null,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        action: entry.action,
        data: (entry.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
