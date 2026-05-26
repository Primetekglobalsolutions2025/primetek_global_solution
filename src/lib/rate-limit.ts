// In-Memory store to prevent excessive PostgreSQL database queries.
// Note: If you are running multiple serverless instances in production,
// it is highly recommended to configure Upstash Redis or a standard Redis client
// to distribute and sync rate-limiting states across containers.
interface RateLimitRecord {
  points: number;
  expireAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export class DbRateLimiter {
  private keyPrefix: string;
  private points: number;
  private duration: number; // in seconds
  private blockDuration?: number; // in seconds

  constructor(opts: { keyPrefix: string; points: number; duration: number; blockDuration?: number }) {
    this.keyPrefix = opts.keyPrefix;
    this.points = opts.points;
    this.duration = opts.duration;
    this.blockDuration = opts.blockDuration;
  }

  private prune() {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.expireAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }

  async get(key: string) {
    this.prune();
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const record = rateLimitStore.get(fullKey);

    if (!record || record.expireAt <= now) {
      return { remainingPoints: this.points, msBeforeNext: 0 };
    }

    return {
      remainingPoints: record.points,
      msBeforeNext: Math.max(0, record.expireAt - now),
    };
  }

  async consume(key: string) {
    this.prune();
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const record = rateLimitStore.get(fullKey);

    if (!record || record.expireAt <= now) {
      const expireAt = now + this.duration * 1000;
      const nextPoints = this.points - 1;
      rateLimitStore.set(fullKey, {
        points: nextPoints,
        expireAt,
      });
      return { remainingPoints: nextPoints, msBeforeNext: this.duration * 1000 };
    }

    const msBeforeNext = Math.max(0, record.expireAt - now);

    if (record.points <= 0) {
      if (this.blockDuration) {
        const newBlockExpire = now + this.blockDuration * 1000;
        rateLimitStore.set(fullKey, {
          points: 0,
          expireAt: newBlockExpire,
        });
        throw { remainingPoints: 0, msBeforeNext: this.blockDuration * 1000 };
      }
      throw { remainingPoints: 0, msBeforeNext };
    }

    const nextPoints = record.points - 1;
    rateLimitStore.set(fullKey, {
      points: nextPoints,
      expireAt: record.expireAt,
    });

    return { remainingPoints: nextPoints, msBeforeNext };
  }

  async delete(key: string) {
    const fullKey = `${this.keyPrefix}:${key}`;
    rateLimitStore.delete(fullKey);
  }
}

/**
 * Login Rate Limiter
 * - Max 5 failed attempts per IP per 15-minute window
 * - Blocks IP for 15 minutes after threshold exceeded
 * - Uses Supabase Postgres to synchronize limits across serverless instances
 */
export const loginRateLimiter = new DbRateLimiter({
  points: 5,
  duration: 15 * 60,         // 15-minute window
  blockDuration: 15 * 60,    // Block for 15 minutes if exceeded
  keyPrefix: 'login',
});

/**
 * General API rate limiter for public-facing endpoints.
 * - 30 requests per minute per IP
 */
export const apiRateLimiter = new DbRateLimiter({
  points: 30,
  duration: 60,
  keyPrefix: 'api',
});

// CAPTCHA trigger flag at 3 attempts
export const CAPTCHA_THRESHOLD = 3;

/**
 * Helper: Consume a rate-limit point and return a standardized result.
 */
export async function consumeRateLimit(
  limiter: DbRateLimiter,
  key: string
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  try {
    await limiter.consume(key);
    return { allowed: true };
  } catch (rejRes: any) {
    const retryAfterMs = rejRes?.msBeforeNext ?? 60_000;
    return { allowed: false, retryAfterMs };
  }
}
