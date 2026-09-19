import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Health-check endpoint for the deployment: verifies MongoDB (Mongoose).
 * Postgres/Redis were removed when the backend went pure-MongoDB.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly mongo: Connection) {}

  @Get()
  async health() {
    const mongo = this.mongo.readyState === 1;
    const healthy = mongo;
    return {
      status: healthy ? 'ok' : 'degraded',
      healthy,
      checks: { mongo },
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}