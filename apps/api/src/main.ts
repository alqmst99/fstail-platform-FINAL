import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = Number(process.env.PORT) || config.get<number>('API_PORT', 3001);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const appUrl = config.get<string>('APP_URL', 'http://localhost:3000');

  // ── Security ────────────────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin: [appUrl],
    credentials: true, // Required for HttpOnly cookie auth
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Cookies ─────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Global Validation ───────────────────────────────────────────────
  // Strips unknown properties, validates DTOs, transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true,           // Auto-transform primitives
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── API Prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix('api', { exclude: ['/health'] });

  // ── Swagger (dev only) ──────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FSTail Platform API')
      .setDescription('Internal API for FSTail Solutions Platform')
      .setVersion('1.0')
      .addCookieAuth('accessToken')
      .addTag('auth', 'Authentication & session management')
      .addTag('users', 'User management')
      .addTag('workspaces', 'Workspace management')
      .addTag('clients', 'CRM — client management')
      .addTag('projects', 'CRM — project management')
      .addTag('audits', 'Audit system')
      .addTag('radar', 'Freelancer Radar scanner')
      .addTag('reports', 'Report generation')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
