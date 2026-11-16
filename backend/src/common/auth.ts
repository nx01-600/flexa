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

export type AuthUser = {
  sub: string;
  role: Role;
  name: string;
  companyId: string | null;
  workerId: string | null;
};

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
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido');
    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }

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
