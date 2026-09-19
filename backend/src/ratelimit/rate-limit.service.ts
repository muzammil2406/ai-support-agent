import { Injectable } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ms the caller should wait before retrying (0 when allowed). */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter, in-memory per process instance.
 *
 * Suitable for this deployment (single auto-scaled instance on Render):
 * counters live in a Map and are pruned lazily on access, so stale keys
 * never accumulate. For a multi-instance backend this would need a shared
 * store (Redis), but Nova is intentionally MongoDB-only now.
 */
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const ttlMs = windowSeconds * 1000;

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + ttlMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (this.buckets.size > 10_000) {
      const expired: string[] = [];
      for (const [k, b] of this.buckets) {
        if (b.resetAt <= now) expired.push(k);
      }
      for (const k of expired) this.buckets.delete(k);
    }

    const allowed = bucket.count <= limit;
    return {
      allowed,
      remaining: Math.max(limit - bucket.count, 0),
      retryAfterMs: allowed ? 0 : bucket.resetAt - now,
    };
  }
}