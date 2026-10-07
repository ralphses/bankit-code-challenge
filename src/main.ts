import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder().setTitle('Bankit Transfer Service').setDescription('Atomic account transfers').setVersion('1.0').addBasicAuth().build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger-ui.html', app, document);
    SwaggerModule.setup('swagger', app, document);
    const sendDocument = (_request: unknown, response: { json: (value: unknown) => void }) => response.json(document);
    app.getHttpAdapter().get('/v3/api-docs', sendDocument);
    app.getHttpAdapter().get('/swagger-json', sendDocument);
  }
  await app.listen(Number(process.env.PORT ?? 8080));
}

void bootstrap();
