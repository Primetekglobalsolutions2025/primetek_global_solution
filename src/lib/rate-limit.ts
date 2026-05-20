import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * Login Rate Limiter
 * - Max 5 failed attempts per IP per 15-minute window
 * - Blocks IP for 15 minutes after threshold exceeded
 * - Uses in-memory sliding window (safe for single-instance deployments)
 *
 * NOTE: For multi-instance / serverless deployments, swap to
 *       RateLimiterRedis or RateLimiterPostgres.
 */
export const loginRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60,         // 15-minute window
  blockDuration: 15 * 60,    // Block for 15 minutes if exceeded
  keyPrefix: 'login',        // Namespace to avoid collisions
});

/**
 * General API rate limiter for public-facing endpoints.
 * - 30 requests per minute per IP
 */
export const apiRateLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,              // 1-minute window
  keyPrefix: 'api',
});

// CAPTCHA trigger flag at 3 attempts
export const CAPTCHA_THRESHOLD = 3;

/**
 * Helper: Consume a rate-limit point and return a standardised result.
 * Returns { allowed: true } on success, or { allowed: false, retryAfterMs }
 * on rejection.
 */
export async function consumeRateLimit(
  limiter: RateLimiterMemory,
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
