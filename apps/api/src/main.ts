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

  // Orígenes permitidos (separados por coma en env, o defaults)
  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ||
    config.get<string>('APP_URL') ||
    'http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // En desarrollo, permitir también localhost y 127.0.0.1
  if (nodeEnv !== 'production') {
    const devOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
    ];
    for (const o of devOrigins) {
      if (!corsOrigins.includes(o)) corsOrigins.push(o);
    }
  }

  app.use(helmet({
    // Opcional: no bloquear cross-origin resource sharing a nivel CSP
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.enableCors({
    origin: (origin, callback) => {
      // Requests sin Origin (curl, server-to-server, health checks)
      if (!origin) {
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Log útil para debug
      console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${corsOrigins.join(', ')}`);
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
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
