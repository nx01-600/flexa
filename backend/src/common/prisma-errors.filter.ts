import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

// Maps Prisma "not found", "unique violation" and validation errors to 404 / 409 / 400 instead of 500.
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaErrorsFilter.name);

  catch(e: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof Prisma.PrismaClientValidationError) {
      // Wrong type/shape reached the query (e.g. a float into an Int column): the input is at fault.
      // Only the last line of the message is logged; the rest echoes the query arguments.
      this.logger.warn(`Prisma validation error: ${e.message.trim().split('\n').pop()}`);
      const statusCode = HttpStatus.BAD_REQUEST;
      return res.status(statusCode).json({ statusCode, message: 'Datos inválidos' });
    }

    const map: Record<string, [number, string]> = {
      P2025: [HttpStatus.NOT_FOUND, 'Registro no encontrado'],
      P2002: [HttpStatus.CONFLICT, 'Ya existe un registro con esos datos'],
      P2003: [HttpStatus.BAD_REQUEST, 'Referencia inválida'],
    };
    const mapped = map[e.code];
    if (!mapped) this.logger.error(`Unhandled Prisma error ${e.code}: ${e.message}`, e.stack);
    const [statusCode, message] = mapped ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Error interno'];
    res.status(statusCode).json({ statusCode, message });
  }
}
