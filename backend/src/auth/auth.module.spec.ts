import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthService, throttleLimit } from './auth.module.js';

const SECRET = 'test-secret-with-enough-length-0123';

const worker = (over: Record<string, unknown> = {}) => ({
  id: 'w1',
  companyId: 'c1',
  docNumber: '1.144.555.999',
  firstName: 'Ana',
  lastName: 'Ruiz',
  email: 'Ana.Ruiz@Empresa.com',
  phone: null,
  enabled: true,
  userId: null,
  ...over,
});

function setup(opts: { workers?: unknown[]; userByEmail?: unknown; workerById?: unknown; cedulaRows?: unknown[]; user?: unknown; attempts?: number } = {}) {
  const tx = {
    user: { create: vi.fn().mockResolvedValue({ id: 'u1', role: 'WORKER', name: 'Ana Ruiz', companyId: 'c1' }) },
    worker: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    worker: {
      findMany: vi.fn().mockResolvedValue(opts.workers ?? [worker()]),
      findUnique: vi.fn().mockResolvedValue(opts.workerById ?? worker()),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(opts.userByEmail ?? opts.user ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { count: vi.fn().mockResolvedValue(opts.attempts ?? 1) },
    $queryRaw: vi.fn().mockResolvedValue(opts.cedulaRows ?? []),
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { log: vi.fn().mockResolvedValue({}) };
  const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '12h' } });
  return { service: new AuthService(prisma as never, jwt, audit as never), prisma, tx, audit, jwt };
}

describe('AuthService.register', () => {
  const dto = { docNumber: '1144555999', email: 'ana.ruiz@empresa.com', password: 'Supersegura1' };

  it('matches a dotted stored cédula, creates the user and returns a session', async () => {
    const s = setup();
    const session = await s.service.register({ ...dto, phone: '3001234567' });
    expect(session.user).toMatchObject({ sub: 'u1', role: 'WORKER', companyId: 'c1', workerId: 'w1' });
    expect(session.accessToken).toBeTruthy();
    const created = s.tx.user.create.mock.calls[0][0].data;
    expect(created.email).toBe('ana.ruiz@empresa.com');
    expect(await bcrypt.compare('Supersegura1', created.passwordHash)).toBe(true);
    expect(s.tx.worker.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { userId: 'u1', status: 'PENDING_KYC', phone: '3001234567' },
    });
    expect(s.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'REGISTERED' }), s.tx);
  });

  it('also normalises the typed cédula', async () => {
    await expect(setup().service.register({ ...dto, docNumber: '1.144.555.999' })).resolves.toHaveProperty('accessToken');
  });

  it('keeps the specific messages of the original flow', async () => {
    await expect(setup({ workers: [] }).service.register(dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ workers: [worker({ docNumber: '999' })] }).service.register(dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ workers: [worker({ enabled: false })] }).service.register(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(setup({ workers: [worker({ userId: 'u9' })] }).service.register(dto)).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({ userByEmail: { id: 'u7' } }).service.register(dto)).rejects.toThrow('El correo ya está en uso');
  });

  it('rejects a document without digits', async () => {
    const s = setup({ workers: [worker({ docNumber: 'abc' })] });
    await expect(s.service.register({ ...dto, docNumber: 'abc' })).rejects.toBeInstanceOf(NotFoundException);
    expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AuthService.login by cédula', () => {
  const dto = { email: '1.144.555.999', password: 'Flexa2026!' };

  it('rejects a cédula registered in more than one company and asks for the email', async () => {
    const s = setup({ cedulaRows: [{ userId: 'u1' }, { userId: 'u2' }] });
    const err = await s.service.login(dto).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toMatch(/correo electrónico/);
    expect(s.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('resolves a single match through the normalised lookup and the password check', async () => {
    const passwordHash = await bcrypt.hash('Flexa2026!', 4);
    const s = setup({ cedulaRows: [{ userId: 'u1' }], user: { id: 'u1', active: true, role: 'WORKER', name: 'Ana', companyId: 'c1', passwordHash, worker: { id: 'w1' } } });
    const session = await s.service.login(dto);
    expect(s.prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
    expect(session.user.workerId).toBe('w1');
  });

  it('falls back to a plain email lookup when the cédula matches nobody', async () => {
    const s = setup({ cedulaRows: [] });
    await expect(s.service.login(dto)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not query workers when the identifier is an email', async () => {
    const s = setup();
    await expect(s.service.login({ email: 'a@b.co', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('throttleLimit', () => {
  it('defaults to 20 and reads THROTTLE_LIMIT', () => {
    expect(throttleLimit('')).toBe(20);
    expect(throttleLimit('abc')).toBe(20);
    expect(throttleLimit('1000')).toBe(1000);
  });
});
