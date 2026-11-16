import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { FundingProvider, KycProvider, PaymentsProvider } from '../common/providers.js';

// Shared infrastructure: database, audit trail and the external-actor adapters.
@Global()
@Module({
  providers: [PrismaService, AuditService, KycProvider, FundingProvider, PaymentsProvider],
  exports: [PrismaService, AuditService, KycProvider, FundingProvider, PaymentsProvider],
})
export class PrismaModule {}
