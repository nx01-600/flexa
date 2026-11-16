import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth.js';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public() @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: 'flexa-api', time: new Date() };
  }
}
