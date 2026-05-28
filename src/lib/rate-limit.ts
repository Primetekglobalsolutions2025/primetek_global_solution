import { supabaseAdmin } from './supabase-admin';

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
    const now = Date.now();

    try {
      const { data: record, error } = await supabaseAdmin
        .from('rate_limits')
        .select('points, expire_at')
        .eq('key', fullKey)
        .maybeSingle();

      if (error || !record) {
        return { remainingPoints: this.points, msBeforeNext: 0 };
      }

      const expireAt = new Date(record.expire_at).getTime();
      if (expireAt <= now) {
        return { remainingPoints: this.points, msBeforeNext: 0 };
      }

      return {
        remainingPoints: record.points,
        msBeforeNext: Math.max(0, expireAt - now),
      };
    } catch (err) {
      console.error('[DbRateLimiter] Error in get:', err);
      return { remainingPoints: this.points, msBeforeNext: 0 };
    }
  }

  async consume(key: string) {
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();

    try {
      const { data: record, error } = await supabaseAdmin
        .from('rate_limits')
        .select('points, expire_at')
        .eq('key', fullKey)
        .maybeSingle();

      if (error) {
        console.error('[DbRateLimiter] DB Error on consume fetch:', error);
        return { remainingPoints: this.points, msBeforeNext: 0 };
      }

      const expireAt = record ? new Date(record.expire_at).getTime() : 0;

      if (!record || expireAt <= now) {
        const nextPoints = this.points - 1;
        const newExpireIso = new Date(now + this.duration * 1000).toISOString();
        
        await supabaseAdmin
          .from('rate_limits')
          .upsert({
            key: fullKey,
            points: nextPoints,
            expire_at: newExpireIso
          });

        return { remainingPoints: nextPoints, msBeforeNext: this.duration * 1000 };
      }

      const msBeforeNext = Math.max(0, expireAt - now);

      if (record.points <= 0) {
        if (this.blockDuration) {
          const newBlockExpireIso = new Date(now + this.blockDuration * 1000).toISOString();
          await supabaseAdmin
            .from('rate_limits')
            .update({
              points: 0,
              expire_at: newBlockExpireIso
            })
            .eq('key', fullKey);
          throw { remainingPoints: 0, msBeforeNext: this.blockDuration * 1000 };
        }
        throw { remainingPoints: 0, msBeforeNext };
      }

      const nextPoints = record.points - 1;
      await supabaseAdmin
        .from('rate_limits')
        .update({ points: nextPoints })
        .eq('key', fullKey);

      return { remainingPoints: nextPoints, msBeforeNext };
    } catch (err: any) {
      if (err && typeof err === 'object' && 'remainingPoints' in err) {
        throw err;
      }
      console.error('[DbRateLimiter] Error in consume:', err);
      return { remainingPoints: this.points, msBeforeNext: 0 };
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
      console.error('[DbRateLimiter] Error in delete:', err);
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

/**
 * Attendance API rate limiter (check-in/check-out).
 * - 10 requests per minute per IP+userId combination
 */
export const attendanceRateLimiter = new DbRateLimiter({
  points: 10,
  duration: 60,
  keyPrefix: 'attendance',
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
