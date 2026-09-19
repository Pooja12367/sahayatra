import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import fs from 'fs';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const NODE_ENV = process.env.NODE_ENV || 'development';

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const body = req.body as unknown;

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const requestBody = body as Record<string, unknown>;

      for (const key in requestBody) {
        if (requestBody[key] === '') {
          requestBody[key] = undefined;
        }
      }
    }

    next();
  });

  const uploadDirs = [
    join(process.cwd(), 'uploads'),
    join(process.cwd(), 'uploads', 'temp'),
    join(process.cwd(), 'uploads', 'images'),
    join(process.cwd(), 'uploads', 'documents'),
  ];
  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/api/uploads',
  });

  app.use(cookieParser());

  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'https://ambu-sense-frontend.vercel.app',
    'https://ambusense-frontend.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      validationError: { target: false, value: false },
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const firstError = errors[0];
        const constraints = firstError?.constraints;
        if (!constraints) return new BadRequestException('Validation failed');
        return new BadRequestException(Object.values(constraints)[0]);
      },
    }),
  );

  app.setGlobalPrefix('api');

  if (NODE_ENV !== 'production') {
    const swaggerPassword = process.env.SWAGGER_PASSWORD;

    if (swaggerPassword) {
      const config = new DocumentBuilder()
        .setTitle('AmbuSense API')
        .setDescription(
          'API documentation for AmbuSense ambulance dispatch, emergency requests, driver workflows, uploads, and authentication.',
        )
        .setVersion('1.0')
        .addCookieAuth(
          'better-auth.session_token',
          { type: 'apiKey', in: 'cookie' },
          'session',
        )
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, config);

      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
        },
      });

      console.log(
        `Swagger UI is protected with Basic Auth ? http://localhost:${configService.get('PORT')}/api/docs`,
      );
    } else {
      console.warn('SWAGGER_PASSWORD not set — Swagger UI disabled');
    }
  }

  const PORT = configService.get<number>('PORT') ?? 4001;
  await app.listen(PORT, '0.0.0.0');
  console.log(`API running on http://localhost:${PORT}/api`);
  if (NODE_ENV !== 'production' && process.env.SWAGGER_PASSWORD) {
    console.log(`Swagger docs: http://localhost:${PORT}/api/docs`);
  }
}

void bootstrap();
