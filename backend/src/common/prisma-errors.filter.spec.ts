import { Logger, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaErrorsFilter } from './prisma-errors.filter.js';

const respond = (e: Error) => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
  new PrismaErrorsFilter().catch(e as never, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
};

const known = (code: string) => new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

describe('PrismaErrorsFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps PrismaClientValidationError to 400 with a Spanish message', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const e = new Prisma.PrismaClientValidationError('Invalid `prisma.x.create()`\n  Argument `a`: Expected Int, provided Float.', {
      clientVersion: 'test',
    });
    expect(respond(e)).toEqual({ status: 400, body: { statusCode: 400, message: 'Datos inválidos' } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Expected Int, provided Float.'));
  });

  it('keeps the existing known-code mappings', () => {
    expect(respond(known('P2025')).status).toBe(404);
    expect(respond(known('P2002')).status).toBe(409);
    expect(respond(known('P2003')).status).toBe(400);
  });

  it('logs an unmapped Prisma error before answering the generic 500', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    expect(respond(known('P9999'))).toEqual({ status: 500, body: { statusCode: 500, message: 'Error interno' } });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('P9999');
  });
});
