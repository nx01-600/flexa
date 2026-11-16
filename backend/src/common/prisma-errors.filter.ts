import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

// Maps Prisma "not found" and "unique violation" errors to 404 / 409 instead of 500.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorsFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const map: Record<string, [number, string]> = {
      P2025: [HttpStatus.NOT_FOUND, 'Registro no encontrado'],
      P2002: [HttpStatus.CONFLICT, 'Ya existe un registro con esos datos'],
      P2003: [HttpStatus.BAD_REQUEST, 'Referencia inválida'],
    };
    const [statusCode, message] = map[e.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Error interno'];
    res.status(statusCode).json({ statusCode, message });
  }
}
