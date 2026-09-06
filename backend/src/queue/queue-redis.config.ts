import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisOptions as BullRedisOptions } from 'bullmq';

/**
 * Builds the socket-connected Redis client options that BullMQ runs on.
 *
 * IMPORTANT (Upstash caveat): the rest of the app talks to Upstash Redis over
 * REST (`@upstash/redis`), but BullMQ cannot run on a REST client — it needs a
 * real socket connection for blocking commands, pub/sub and Lua scripts. So
 * BullMQ uses its own Redis connection driven by the `BULLMQ_REDIS_URL`
 * env var:
 *
 *   - Local Redis:  `redis://localhost:6379`
 *   - Upstash:      `rediss://USERNAME:PASSWORD@...upstash.io:6379`  (TLS)
 *
 * The Upstash console exposes this TLS URL separately from the REST url/token.
 */
@Injectable()
export class BullRedisConfig {
  private readonly logger = new Logger(BullRedisConfig.name);

  constructor(private readonly config: ConfigService) {}

  resolver(): { connection: BullRedisOptions } {
    const url = this.config.get<string>('BULLMQ_REDIS_URL');

    if (!url) {
      this.logger.warn(
        'BULLMQ_REDIS_URL is not set — falling back to redis://localhost:6379',
      );
      return {
        connection: {
          host: '127.0.0.1',
          port: 6379,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      };
    }

    return { connection: this.connectionFromUrl(url) };
  }

  private connectionFromUrl(url: string): BullRedisOptions {
    const parsed = new URL(url);

    const base: BullRedisOptions = {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      // BullMQ needs these to avoid eviction/queue juggling warnings and to
      // allow jobs to be picked up across restarts.
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    if (parsed.protocol === 'rediss:') {
      base.tls = {};
    }

    return base;
  }
}