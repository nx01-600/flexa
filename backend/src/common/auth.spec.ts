import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { assertJwtSecret, AuthGuard, DEV_JWT_SECRET, isDevEnv, normalizeDoc, Public } from './auth.js';

describe('assertJwtSecret', () => {
  it('rejects a missing or empty secret', () => {
    expect(() => assertJwtSecret(undefined, 'development')).toThrow(/JWT_SECRET/);
    expect(() => assertJwtSecret('', 'development')).toThrow(/JWT_SECRET/);
  });

  it('rejects a secret shorter than 16 characters', () => {
    expect(() => assertJwtSecret('exactly-16-chars', 'development')).not.toThrow(); // 16 chars is the minimum
    expect(() => assertJwtSecret('short-secret-1', 'development')).toThrow(/16/);
  });

  it('accepts the .env.example placeholder only with an explicit development or test NODE_ENV', () => {
    expect(assertJwtSecret(DEV_JWT_SECRET, 'development')).toBe(DEV_JWT_SECRET);
    expect(assertJwtSecret(DEV_JWT_SECRET, 'test')).toBe(DEV_JWT_SECRET);
    // Fails closed: an empty or unknown NODE_ENV is treated as production.
    expect(() => assertJwtSecret(DEV_JWT_SECRET, '')).toThrow(/placeholder/);
    expect(() => assertJwtSecret(DEV_JWT_SECRET, 'staging')).toThrow(/placeholder/);
    expect(() => assertJwtSecret(DEV_JWT_SECRET, 'production')).toThrow(/placeholder/);
    expect(() => assertJwtSecret('cambia-esto-en-produccion', 'production')).toThrow(/placeholder/);
  });

  it('accepts a real secret in production', () => {
    const secret = 'k9Zq2vX7mT4pL8wRb3NcY6hJ1sDfG5aE';
    expect(assertJwtSecret(secret, 'production')).toBe(secret);
  });
});

describe('isDevEnv', () => {
  it('is true only for development and test', () => {
    expect(isDevEnv('development')).toBe(true);
    expect(isDevEnv('test')).toBe(true);
    expect(isDevEnv('production')).toBe(false);
    expect(isDevEnv('')).toBe(false);
    expect(isDevEnv('Development')).toBe(false);
  });
});

describe('normalizeDoc', () => {
  it('keeps digits only', () => {
    expect(normalizeDoc('1.144.555.999')).toBe('1144555999');
    expect(normalizeDoc(' 1144 555-999 ')).toBe('1144555999');
    expect(normalizeDoc('abc')).toBe('');
  });

  it('makes a dotted stored value equal to the typed one', () => {
    expect(normalizeDoc('1.144.555.999')).toBe(normalizeDoc('1144555999'));
  });
});

describe('AuthGuard', () => {
  const jwt = new JwtService({ secret: 'test-secret-with-enough-length-0123' });
  const claims = { sub: 'u1', role: 'WORKER', name: 'Ana', companyId: 'c1', workerId: 'w1' };

  const run = async (
    token: string | null,
    dbUser: unknown,
    handlerPublic = false,
  ) => {
    const findUnique = vi.fn().mockResolvedValue(dbUser);
    const guard = new AuthGuard(jwt, new Reflector(), { user: { findUnique } } as never);
    const handler = () => undefined;
    if (handlerPublic) Public()(handler as never, 'h', { value: handler } as never);
    const req: Record<string, unknown> = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const ctx = {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { result: guard.canActivate(ctx), findUnique, req };
  };

  it('lets a valid token through when the account still matches', async () => {
    const token = await jwt.signAsync(claims);
    const { result, findUnique, req } = await run(token, { active: true, role: 'WORKER', companyId: 'c1' });
    await expect(result).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { active: true, role: true, companyId: true } });
    expect((req.user as { sub: string }).sub).toBe('u1');
  });

  it.each([
    ['the user was deleted', null],
    ['the user was deactivated', { active: false, role: 'WORKER', companyId: 'c1' }],
    ['the role changed', { active: true, role: 'COMPANY_ADMIN', companyId: 'c1' }],
    ['the company changed', { active: true, role: 'WORKER', companyId: 'c2' }],
  ])('rejects with 401 when %s', async (_name, dbUser) => {
    const token = await jwt.signAsync(claims);
    const { result } = await run(token, dbUser);
    await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token without sub (e.g. a registration challenge) without touching the DB', async () => {
    const token = await jwt.signAsync({ purpose: 'register', workerId: 'w1', codeHash: 'x' });
    const { result, findUnique } = await run(token, { active: true, role: 'WORKER', companyId: 'c1' });
    await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a missing or invalid token', async () => {
    await expect((await run(null, null)).result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect((await run('not-a-jwt', null)).result).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not check anything on @Public() routes', async () => {
    const { result, findUnique } = await run(null, null, true);
    await expect(result).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
