import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfterMs: number;
}

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 * Counters are set with a TTL so stale keys never accumulate.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const bucket = `rl:${key}`;
    const count = await this.redis.incr(bucket);
    if (count === 1) {
      await this.redis.expire(bucket, windowSeconds);
    }
    const ttl = await this.redis.ttl(bucket);
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(limit - count, 0),
      retryAfterMs: allowed ? 0 : ttl * 1000,
    };
  }
}
