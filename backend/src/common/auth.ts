import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuthUser = {
  sub: string;
  role: Role;
  name: string;
  companyId: string | null;
  workerId: string | null;
};

// Value shipped in .env.example: fine for local dev, never accepted in production.
export const DEV_JWT_SECRET = 'dev-only-secret-change-before-deploying';
const REJECTED_IN_PRODUCTION = [DEV_JWT_SECRET, 'cambia-esto-en-produccion'];

// Dev conveniences (placeholder secret, Swagger) need an explicit opt-in: an unset NODE_ENV counts as production.
export const isDevEnv = (nodeEnv: string | undefined = process.env.NODE_ENV) => nodeEnv === 'development' || nodeEnv === 'test';

// Fails fast at startup: a missing or guessable JWT secret would let anyone forge a FLEXA_ADMIN token.
export function assertJwtSecret(secret: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): string {
  if (!secret || secret.length < 16) throw new Error('JWT_SECRET is required and must be at least 16 characters long');
  if (!isDevEnv(nodeEnv) && REJECTED_IN_PRODUCTION.includes(secret)) {
    throw new Error('JWT_SECRET still has the .env.example placeholder value; set a real secret, or NODE_ENV=development for local dev');
  }
  return secret;
}

// Documents are compared by digits only: "1.144.555.999" and "1144555999" are the same cédula.
export const normalizeDoc = (doc: string) => doc.replace(/\D/g, '');

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

// Global guard: every route needs a valid JWT unless marked @Public(); @Roles() narrows access.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido');
    let payload: AuthUser;
    try {
      payload = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    // Tokens live 12h: re-check the account so deactivation or a role/company change applies now.
    // Tokens without `sub` (e.g. the registration challenge) never match a user.
    const current =
      typeof payload.sub === 'string'
        ? await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { active: true, role: true, companyId: true } })
        : null;
    if (!current || !current.active || current.role !== payload.role || current.companyId !== payload.companyId) {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    req.user = payload;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para esta operación');
    }
    return true;
  }
}

export function requireCompany(user: AuthUser): string {
  if (!user.companyId) throw new ForbiddenException('Usuario sin empresa asociada');
  return user.companyId;
}

export function requireWorker(user: AuthUser): string {
  if (!user.workerId) throw new ForbiddenException('Usuario sin perfil de trabajador');
  return user.workerId;
}
