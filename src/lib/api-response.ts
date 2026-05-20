import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standardised API error response format.
 * Every API route should use this for consistent client-side handling.
 */
interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
  retryAfter?: number;
}

/**
 * Creates a standardised JSON error response.
 */
export function apiError(
  message: string,
  status: number,
  opts?: { code?: string; details?: unknown; retryAfter?: number }
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message };

  if (opts?.code) body.code = opts.code;
  if (opts?.details) body.details = opts.details;
  if (opts?.retryAfter) body.retryAfter = opts.retryAfter;

  const headers: Record<string, string> = {};
  if (opts?.retryAfter) {
    headers['Retry-After'] = String(Math.ceil(opts.retryAfter));
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * Creates a standardised JSON success response.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status: number = 200
): NextResponse<T & { success: true }> {
  return NextResponse.json({ success: true as const, ...data }, { status });
}

/**
 * Handles a caught error and returns the correct API response.
 * Use inside `catch (err)` blocks at the end of route handlers.
 */
export function handleApiError(err: unknown, context?: string): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    return apiError('Validation failed', 400, {
      code: 'VALIDATION_ERROR',
      details: err.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(`[API Error]${context ? ` ${context}:` : ''}`, message);

  return apiError('Internal server error', 500, { code: 'INTERNAL_ERROR' });
}
