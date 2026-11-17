import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaErrorsFilter } from '../../src/common/prisma-errors.filter.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { User } from '../../src/generated/prisma/client.js';

export type TestApp = Awaited<ReturnType<typeof bootApp>>;

// Boots the real AppModule over flexa_test with the same prefix, pipe and filter as src/main.ts.
export async function bootApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaErrorsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Listening once keeps the server stable for the Promise.all (concurrency) tests.
  await app.listen(0);
  const server = app.getHttpServer();
  const jwt = app.get(JwtService);

  const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token?: string) => {
    const req = request(server)[method](`/api${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  return {
    app,
    prisma: app.get(PrismaService),
    // A session token for a fixture user, as AuthService.issue() would sign it.
    tokenFor: (user: User, workerId: string | null = null) =>
      jwt.sign({ sub: user.id, role: user.role, name: user.name, companyId: user.companyId, workerId }),
    get: (path: string, token?: string) => call('get', path, token),
    post: (path: string, token?: string) => call('post', path, token),
    patch: (path: string, token?: string) => call('patch', path, token),
    del: (path: string, token?: string) => call('delete', path, token),
  };
}
