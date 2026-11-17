import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, normalizeDoc, Public } from '../common/auth.js';
import type { User } from '../generated/prisma/client.js';

class LoginDto {
  // Email, or the document number for workers (the app asks for the cédula)
  @IsString() email: string;
  @IsString() password: string;
  // Optional: restrict the login surface ("worker" app vs "company" panel vs "admin")
  @IsOptional() @IsString() surface?: 'worker' | 'company' | 'admin';
}

class RegisterDto {
  @IsString() docNumber: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() phone?: string;
}

const SURFACE_ROLES = {
  worker: ['WORKER'],
  company: ['COMPANY_ADMIN', 'COMPANY_FINANCE'],
  admin: ['FLEXA_ADMIN'],
} as const;

export const throttleLimit = (raw = process.env.THROTTLE_LIMIT) => Number.parseInt(raw ?? '', 10) || 20;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  private async issue(user: User & { worker: { id: string } | null }) {
    const payload: AuthUser = {
      sub: user.id,
      role: user.role,
      name: user.name,
      companyId: user.companyId,
      workerId: user.worker?.id ?? null,
    };
    return { accessToken: await this.jwt.signAsync(payload), user: payload };
  }

  async login(dto: LoginDto) {
    const id = dto.email.trim().toLowerCase();
    let userId: string | null = null;
    if (!id.includes('@')) {
      const digits = normalizeDoc(id);
      // Stored documents may contain dots, so both sides are reduced to digits.
      // shortcut: full scan of Worker per cédula login, add an expression index when the table grows.
      const rows = digits
        ? await this.prisma.$queryRaw<{ userId: string }[]>`
            SELECT "userId" FROM "Worker"
            WHERE "userId" IS NOT NULL AND regexp_replace("docNumber", '[^0-9]', '', 'g') = ${digits}`
        : [];
      // The cédula is unique per company only: never pick an arbitrary account.
      if (rows.length > 1) {
        throw new BadRequestException('Esta cédula está registrada en más de una empresa. Inicia sesión con tu correo electrónico.');
      }
      userId = rows[0]?.userId ?? null;
    }
    const user = await this.prisma.user.findUnique({
      where: userId ? { id: userId } : { email: id },
      include: { worker: { select: { id: true } } },
    });
    if (!user || !user.active || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    if (dto.surface && !(SURFACE_ROLES[dto.surface] as readonly string[]).includes(user.role)) {
      throw new UnauthorizedException('Esta cuenta no tiene acceso a esta aplicación');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, companyId: user.companyId, entity: 'User', entityId: user.id, action: 'LOGIN' });
    return this.issue(user);
  }

  // Módulo 1: only workers previously loaded and enabled by their company can register.
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const doc = normalizeDoc(dto.docNumber);
    // Stored documents may contain dots, so both sides are compared as digits.
    const candidates = await this.prisma.worker.findMany({ where: { email: { equals: email, mode: 'insensitive' } } });
    const worker = doc ? candidates.find((w) => normalizeDoc(w.docNumber) === doc) : undefined;
    if (!worker) throw new NotFoundException('No encontramos un trabajador habilitado con ese documento y correo');
    if (!worker.enabled) throw new UnauthorizedException('Tu empresa no ha habilitado FLEXA para ti');
    if (worker.userId) throw new ConflictException('Este trabajador ya está registrado');
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('El correo ya está en uso');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: `${worker.firstName} ${worker.lastName}`,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: 'WORKER',
          companyId: worker.companyId,
        },
      });
      await tx.worker.update({
        where: { id: worker.id },
        data: { userId: user.id, status: 'PENDING_KYC', phone: dto.phone ?? worker.phone },
      });
      await this.audit.log(
        { actorId: user.id, companyId: worker.companyId, entity: 'Worker', entityId: worker.id, action: 'REGISTERED' },
        tx,
      );
      return user;
    });
    return this.issue({ ...user, worker: { id: worker.id } });
  }
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // Brute-force sensitive routes carry the strict limit (THROTTLE_LIMIT per minute per IP); nothing else is throttled.
  @Public() @UseGuards(ThrottlerGuard) @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public() @UseGuards(ThrottlerGuard) @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

@Module({
  imports: [ThrottlerModule.forRootAsync({ useFactory: () => [{ ttl: 60_000, limit: throttleLimit() }] })],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
