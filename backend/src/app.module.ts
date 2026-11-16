import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthGuard } from './common/auth.js';
import { AuthModule } from './auth/auth.module.js';
import { EarningsService } from './ewa/earnings.service.js';
import { AdvancesService } from './ewa/advances.service.js';
import { OnboardingService, WorkerController } from './ewa/worker.controller.js';
import { CompanyController } from './company/company.controller.js';
import { PayrollController, PayrollService } from './payroll/payroll.controller.js';
import { CompensationController } from './payroll/compensation.controller.js';
import { AnalyticsController } from './analytics/analytics.controller.js';
import { SupportController } from './support/support.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '12h' },
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    WorkerController,
    CompanyController,
    PayrollController,
    CompensationController,
    AnalyticsController,
    SupportController,
    AdminController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    EarningsService,
    AdvancesService,
    OnboardingService,
    PayrollService,
  ],
})
export class AppModule {}
