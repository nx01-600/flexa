import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, requireCompany } from '../common/auth.js';
import { code } from '../common/util.js';
import { TicketStatus } from '../generated/prisma/enums.js';
import { enumParam } from '../company/company.controller.js';

class TicketDto {
  @IsString() category: string;
  @IsString() @MinLength(3) subject: string;
  @IsString() @MinLength(5) description: string;
  @IsOptional() @IsString() advanceId?: string;
}
class ReplyDto {
  @IsString() @MinLength(1) body: string;
}
class StatusDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'CLOSED']) status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED';
}

// Módulo 10: support requests for workers and companies; FLEXA admins answer them.
@Controller('support')
export class SupportController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Workers see their own tickets, company users see their company's, FLEXA sees all.
  private scope(u: AuthUser) {
    if (u.role === 'FLEXA_ADMIN') return {};
    if (u.role === 'WORKER') return { userId: u.sub };
    return { user: { companyId: requireCompany(u) } };
  }

  @Get('categories')
  categories() {
    return ['Retiro no recibido', 'Monto disponible', 'Cuenta de destino', 'Validación de identidad', 'Descuento en nómina', 'Pagos de servicios', 'Otro'];
  }

  @Get('tickets')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string) {
    return this.prisma.supportTicket.findMany({
      where: { ...this.scope(u), ...(status ? { status: enumParam(TicketStatus, status) } : {}) },
      include: { user: { select: { name: true, role: true } }, _count: { select: { messages: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('tickets')
  async create(@CurrentUser() u: AuthUser, @Body() dto: TicketDto) {
    if (dto.advanceId) {
      const a = await this.prisma.advance.findFirst({ where: { id: dto.advanceId, ...(u.workerId ? { workerId: u.workerId } : { worker: { companyId: u.companyId ?? '' } }) } });
      if (!a) throw new BadRequestException('Operación no encontrada');
    }
    const ticket = await this.prisma.supportTicket.create({ data: { ...dto, code: code('SOP'), userId: u.sub } });
    await this.audit.log({ actorId: u.sub, companyId: u.companyId, entity: 'SupportTicket', entityId: ticket.id, action: 'CREATED' });
    return ticket;
  }

  @Get('tickets/:id')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { OR: [{ id }, { code: id }], ...this.scope(u) },
      include: {
        messages: { include: { author: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
        advance: { select: { code: true, amount: true, status: true } },
        user: { select: { name: true, email: true, role: true, companyId: true } },
      },
    });
    if (!t) throw new NotFoundException('Solicitud de soporte no encontrada');
    return t;
  }

  @Post('tickets/:id/messages')
  async reply(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReplyDto) {
    const t = await this.one(u, id);
    // Among company roles only the admin answers others' tickets; Finance only replies on the ones it opened.
    if (u.role === 'COMPANY_FINANCE' && t.userId !== u.sub) throw new ForbiddenException('Solo el administrador de la empresa puede responder');
    if (t.status === 'CLOSED') throw new BadRequestException('La solicitud está cerrada');
    const msg = await this.prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: u.sub, body: dto.body } });
    const fromSupport = u.role === 'FLEXA_ADMIN';
    await this.prisma.supportTicket.update({ where: { id: t.id }, data: { status: fromSupport ? 'WAITING_USER' : 'IN_PROGRESS' } });
    return msg;
  }

  @Patch('tickets/:id/status')
  async status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: StatusDto) {
    const t = await this.one(u, id);
    if (u.role !== 'FLEXA_ADMIN') {
      if (dto.status !== 'CLOSED') throw new ForbiddenException('Solo puedes cerrar tu solicitud');
      // Company staff reads worker tickets but only the worker (or FLEXA) closes them.
      if (u.role !== 'WORKER' && t.user.role === 'WORKER') throw new ForbiddenException('Solo el trabajador o FLEXA pueden cerrar esta solicitud');
    }
    await this.prisma.supportTicket.update({ where: { id: t.id }, data: { status: dto.status } });
    await this.audit.log({ actorId: u.sub, companyId: t.user.companyId, entity: 'SupportTicket', entityId: t.id, action: `STATUS_${dto.status}` });
    return { ok: true };
  }
}
