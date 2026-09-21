import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEnv } from './config/env';
import { origenPermitido } from './common/utils/cors';

export const buildOpenApi = (app: NestExpressApplication) =>
  SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AssistIQ API')
      .setDescription('Control de asistencia y cálculo de horas — CodingIQ')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );

// Configuración compartida entre ejecución local (main.ts) y Vercel (api/index.ts)
export const createApp = async (): Promise<NestExpressApplication> => {
  const env = getEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.isProduction ? ['error', 'warn'] : ['log', 'error', 'warn'],
  });

  // Detrás del proxy de Vercel: permite obtener la IP real del cliente en req.ip
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    // Origen no permitido: simplemente no se envían cabeceras CORS y el navegador bloquea la lectura
    origin: (origen, callback) => callback(null, origenPermitido(origen, env.corsOrigins)),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (env.swaggerEnabled) {
    SwaggerModule.setup('docs', app, buildOpenApi(app), { jsonDocumentUrl: 'docs-json' });
  }

  return app;
};
