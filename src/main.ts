import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as promClient from 'prom-client';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prometheus metrics registry
  const register = new promClient.Registry();
  promClient.collectDefaultMetrics({ register });

  // Metrics endpoint
  app.use('/metrics', async (req: unknown, res: unknown) => {
    const response = res as { set: (key: string, value: string) => void; end: (data: string) => void };
    response.set('Content-Type', register.contentType);
    response.end(await register.metrics());
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
