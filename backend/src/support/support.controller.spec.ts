import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupportController } from './support.controller.js';

type Role = 'WORKER' | 'COMPANY_ADMIN' | 'COMPANY_FINANCE' | 'FLEXA_ADMIN';
const user = (role: Role, over: Record<string, unknown> = {}) => ({ sub: `u-${role}`, role, name: role, companyId: role === 'FLEXA_ADMIN' ? null : 'c1', workerId: role === 'WORKER' ? 'w1' : null, ...over }) as never;

// The ticket was opened by `openedBy`; the fake echoes the scope it was queried with so isolation can be asserted.
function setup(openedBy: Role = 'WORKER') {
  const prisma = {
    supportTicket: {
      findFirst: vi.fn(async () => ({ id: 't1', status: 'OPEN', user: { role: openedBy, companyId: 'c1' }, messages: [] })),
      findMany: vi.fn(async () => []),
      update: vi.fn(),
    },
    ticketMessage: { create: vi.fn(async ({ data }) => ({ id: 'm1', ...data })) },
  };
  const audit = { log: vi.fn() };
  return { controller: new SupportController(prisma as never, audit as never), prisma };
}

describe('SupportController.reply', () => {
  it('forbids company Finance', async () => {
    const { controller, prisma } = setup();
    await expect(controller.reply(user('COMPANY_FINANCE'), 't1', { body: 'hola' })).rejects.toThrow(ForbiddenException);
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
  });

  it('lets Finance reply on a ticket Finance opened', async () => {
    const { controller, prisma } = setup('COMPANY_FINANCE');
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't1', userId: 'u-COMPANY_FINANCE', status: 'WAITING_USER', user: { role: 'COMPANY_FINANCE', companyId: 'c1' } } as never);
    await controller.reply(user('COMPANY_FINANCE'), 't1', { body: 'hola' });
    expect(prisma.ticketMessage.create).toHaveBeenCalled();
  });

  it.each(['COMPANY_ADMIN', 'WORKER', 'FLEXA_ADMIN'] as const)('lets %s reply', async (role) => {
    const { controller, prisma } = setup();
    await controller.reply(user(role), 't1', { body: 'hola' });
    expect(prisma.ticketMessage.create).toHaveBeenCalled();
  });

  it('refuses a closed ticket', async () => {
    const { controller, prisma } = setup();
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't1', status: 'CLOSED', user: { role: 'WORKER', companyId: 'c1' } } as never);
    await expect(controller.reply(user('COMPANY_ADMIN'), 't1', { body: 'hola' })).rejects.toThrow(BadRequestException);
  });
});

describe('SupportController.status', () => {
  it('company staff cannot close a ticket opened by a worker', async () => {
    for (const role of ['COMPANY_ADMIN', 'COMPANY_FINANCE'] as const) {
      const { controller, prisma } = setup('WORKER');
      await expect(controller.status(user(role), 't1', { status: 'CLOSED' })).rejects.toThrow(ForbiddenException);
      expect(prisma.supportTicket.update).not.toHaveBeenCalled();
    }
  });

  it('company staff can close a ticket opened by company staff', async () => {
    const { controller, prisma } = setup('COMPANY_ADMIN');
    await controller.status(user('COMPANY_ADMIN'), 't1', { status: 'CLOSED' });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'CLOSED' } });
  });

  it('the worker closes their own ticket and FLEXA closes any', async () => {
    for (const role of ['WORKER', 'FLEXA_ADMIN'] as const) {
      const { controller, prisma } = setup('WORKER');
      await controller.status(user(role), 't1', { status: 'CLOSED' });
      expect(prisma.supportTicket.update).toHaveBeenCalledTimes(1);
    }
  });

  it('only FLEXA sets statuses other than CLOSED', async () => {
    const { controller, prisma } = setup('COMPANY_ADMIN');
    await expect(controller.status(user('COMPANY_ADMIN'), 't1', { status: 'IN_PROGRESS' })).rejects.toThrow(ForbiddenException);
    await expect(controller.status(user('WORKER'), 't1', { status: 'OPEN' })).rejects.toThrow(ForbiddenException);
    await controller.status(user('FLEXA_ADMIN'), 't1', { status: 'WAITING_USER' });
    expect(prisma.supportTicket.update).toHaveBeenCalledTimes(1);
  });
});

describe('SupportController scope', () => {
  it('keeps company staff inside their company, workers inside their own tickets', async () => {
    const { controller, prisma } = setup();
    await controller.one(user('COMPANY_ADMIN'), 't1');
    expect(prisma.supportTicket.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { OR: [{ id: 't1' }, { code: 't1' }], user: { companyId: 'c1' } } }));
    await controller.one(user('WORKER'), 't1');
    expect(prisma.supportTicket.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { OR: [{ id: 't1' }, { code: 't1' }], userId: 'u-WORKER' } }));
  });

  it('never queries with a null companyId (that would match FLEXA staff tickets)', () => {
    const { controller, prisma } = setup();
    expect(() => controller.list(user('COMPANY_ADMIN', { companyId: null }))).toThrow(ForbiddenException);
    expect(prisma.supportTicket.findMany).not.toHaveBeenCalled();
  });

  it('answers 400 for an unknown status filter', () => {
    const { controller } = setup();
    expect(() => controller.list(user('FLEXA_ADMIN'), 'BOGUS')).toThrow(BadRequestException);
  });
});
