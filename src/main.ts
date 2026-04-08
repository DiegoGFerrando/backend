import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import dns from 'dns';
import { AppModule } from './app.module';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
  });
  app.useStaticAssets(join(__dirname, 'uploads'), { prefix: '/uploads' });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
