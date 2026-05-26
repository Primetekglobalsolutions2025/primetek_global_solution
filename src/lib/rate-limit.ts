import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Custom database-backed Rate Limiter compatible with RateLimiterMemory interface.
 * Stores rate limits in Supabase PostgreSQL table to support serverless deployments.
 */
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

  async get(key: string) {
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = new Date();

    try {
      const { data, error } = await supabaseAdmin
        .from('rate_limits')
        .select('points, expire_at')
        .eq('key', fullKey)
        .maybeSingle();

      if (error || !data) {
        return { remainingPoints: this.points, msBeforeNext: 0 };
      }

      const expireAt = new Date(data.expire_at);
      if (expireAt <= now) {
        return { remainingPoints: this.points, msBeforeNext: 0 };
      }

      return {
        remainingPoints: data.points,
        msBeforeNext: expireAt.getTime() - now.getTime(),
      };
    } catch (err) {
      console.error('[RateLimiter] Error getting rate limit:', err);
      return { remainingPoints: this.points, msBeforeNext: 0 };
    }
  }

  async consume(key: string) {
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = new Date();

    try {
      const { data, error } = await supabaseAdmin
        .from('rate_limits')
        .select('points, expire_at')
        .eq('key', fullKey)
        .maybeSingle();

      if (error || !data) {
        const expireAt = new Date(now.getTime() + this.duration * 1000);
        await supabaseAdmin
          .from('rate_limits')
          .insert({
            key: fullKey,
            points: this.points - 1,
            expire_at: expireAt.toISOString(),
          });
        return { remainingPoints: this.points - 1, msBeforeNext: this.duration * 1000 };
      }

      const expireAt = new Date(data.expire_at);
      if (expireAt <= now) {
        const newExpireAt = new Date(now.getTime() + this.duration * 1000);
        await supabaseAdmin
          .from('rate_limits')
          .update({
            points: this.points - 1,
            expire_at: newExpireAt.toISOString(),
          })
          .eq('key', fullKey);
        return { remainingPoints: this.points - 1, msBeforeNext: this.duration * 1000 };
      }

      const msBeforeNext = expireAt.getTime() - now.getTime();

      if (data.points <= 0) {
        if (this.blockDuration) {
          const newBlockExpire = new Date(now.getTime() + this.blockDuration * 1000);
          await supabaseAdmin
            .from('rate_limits')
            .update({
              expire_at: newBlockExpire.toISOString(),
            })
            .eq('key', fullKey);
          throw { remainingPoints: 0, msBeforeNext: this.blockDuration * 1000 };
        }
        throw { remainingPoints: 0, msBeforeNext };
      }

      const nextPoints = data.points - 1;
      await supabaseAdmin
        .from('rate_limits')
        .update({
          points: nextPoints,
        })
        .eq('key', fullKey);

      return { remainingPoints: nextPoints, msBeforeNext };
    } catch (err: any) {
      if (err && typeof err.remainingPoints === 'number') {
        throw err;
      }
      console.error('[RateLimiter] Error consuming rate limit:', err);
      return { remainingPoints: this.points - 1, msBeforeNext: this.duration * 1000 };
    }
  }

  async delete(key: string) {
    const fullKey = `${this.keyPrefix}:${key}`;
    try {
      await supabaseAdmin
        .from('rate_limits')
        .delete()
        .eq('key', fullKey);
    } catch (err) {
      console.error('[RateLimiter] Error deleting rate limit:', err);
    }
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
