import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { isDevEnv } from './common/auth.js';
import { PrismaErrorsFilter } from './common/prisma-errors.filter.js';

// BigInt (period budgets) is not JSON-serializable by default.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true });
  app.useGlobalFilters(new PrismaErrorsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // API docs expose every route and DTO: dev only (explicit NODE_ENV=development/test, like the other dev gates).
  if (isDevEnv()) {
    const docs = new DocumentBuilder()
      .setTitle('FLEXA API')
      .setDescription('Acceso anticipado al salario devengado: trabajador, empresa y administración FLEXA')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));
  }

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
