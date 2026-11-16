import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { type AuthUser, CurrentUser, Public } from '../common/auth.js';
import type { User } from '../generated/prisma/client.js';

class LoginDto {
  @IsEmail() email: string;
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
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
    const email = dto.email.toLowerCase();
    const worker = await this.prisma.worker.findFirst({
      where: { docNumber: dto.docNumber, email: { equals: email, mode: 'insensitive' } },
    });
    if (!worker) throw new NotFoundException('No encontramos un trabajador habilitado con ese documento y correo');
    if (!worker.enabled) throw new UnauthorizedException('Tu empresa no ha habilitado FLEXA para ti');
    if (worker.userId) throw new ConflictException('Este trabajador ya está registrado');
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('El correo ya está en uso');

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

  @Public() @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public() @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
