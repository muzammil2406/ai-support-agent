import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

/**
 * Health-check endpoint for the deployment: verifies Postgres (Prisma),
 * MongoDB (Mongoose) and Upstash Redis in one call.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  @Get()
  async health() {
    const checks = {
      db: false,
      mongo: false,
      redis: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch {
      /* keep false */
    }

    checks.mongo = this.mongo.readyState === 1;

    try {
      const pong = await this.redis.ping();
      checks.redis = pong === 'PONG';
    } catch {
      /* keep false */
    }

    const healthy = checks.db && checks.mongo && checks.redis;
    return {
      status: healthy ? 'ok' : 'degraded',
      healthy,
      checks,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
