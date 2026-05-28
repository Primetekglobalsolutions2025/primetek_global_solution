import { NextRequest, NextResponse } from 'next/server';
import { checkIn } from '@/app/employee/attendance/actions';
import { getSession } from '@/lib/auth';
import { attendanceRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid or missing request body' }, { status: 400 });
    }
    const { latitude, longitude, deviceFingerprint } = body;
    
    // Extract IP and User-Agent from server-side headers (not client body) to prevent spoofing
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Apply rate limiting
    const rateLimitKey = `${ipAddress}_${session.id}`;
    const rateLimitRes = await consumeRateLimit(attendanceRateLimiter, rateLimitKey);
    if (!rateLimitRes.allowed) {
      const retryAfterSec = Math.ceil(rateLimitRes.retryAfterMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }
    
    const result = await checkIn(latitude, longitude, ipAddress, userAgent, deviceFingerprint);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Checkin API] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
