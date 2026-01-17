import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as promClient from 'prom-client';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prometheus metrics registry
  const register = new promClient.Registry();
  promClient.collectDefaultMetrics({ register });

  // Custom metrics
  const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  // Metrics endpoint
  app.use('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
