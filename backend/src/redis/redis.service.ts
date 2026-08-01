import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis over REST — no persistent socket connection, which makes it
 * ideal for Cloud Run's serverless model (scale-to-zero friendly).
 * Used for: active-chat session state + rate limiting.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor() {
    // Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from env.
    this.client = Redis.fromEnv();
  }

  get upstream(): Redis {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    try {
      const pong = await this.client.ping();
      this.logger.log(`Upstash Redis connected (${pong})`);
    } catch (err) {
      this.logger.warn(`Redis not reachable at boot: ${(err as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    // Upstash REST client holds no sockets to close; nothing needed here.
  }

  // ── JSON helpers for chat-session state ────────────────────────────────
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } else {
      await this.client.set(key, JSON.stringify(value));
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get<string>(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async updateJson<T>(key: string, patch: Partial<T>): Promise<void> {
    const current = (await this.getJson<T>(key)) ?? ({} as T);
    await this.setJson(key, { ...current, ...patch });
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
