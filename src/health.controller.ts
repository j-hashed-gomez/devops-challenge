import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private connection: Connection) {}

  @Get()
  check() {
    const dbState = this.connection.readyState;
    const CONNECTED_STATE: number = 1;
    const isHealthy = dbState === CONNECTED_STATE;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: this.getConnectionStatus(dbState),
        readyState: dbState,
      },
    };
  }

  private getConnectionStatus(state: number): string {
    const states: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[state] ?? 'unknown';
  }
}
