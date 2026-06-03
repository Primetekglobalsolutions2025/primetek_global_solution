import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';
import { verifyMFAToken, decryptSecret } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAuditAction } from '@/lib/audit';
import { loginRateLimiter, consumeRateLimit } from '@/lib/rate-limit';
import { createActiveSession } from '@/lib/security/session-tracker';
import { isOfficeNetwork } from '@/lib/security/network-trust';

export async function POST(request: NextRequest) {
  try {
    const tempToken = request.cookies.get('mfa-pending-token')?.value;
    if (!tempToken) return NextResponse.json({ error: 'MFA session expired' }, { status: 401 });

    const session = await verifyToken(tempToken);
    if (!session || !session.mfa_pending) {
      return NextResponse.json({ error: 'Invalid MFA session' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as any).ip || 'unknown-ip';

    // 1. IP-based MFA rate limiting key
    const mfaIpKey = `mfa_ip:${ip}`;
    // 2. Account-based MFA rate limiting key
    const mfaAccountKey = `mfa_account:${session.id}`;

    // Verify rate limit status for both
    const mfaIpRes = await loginRateLimiter.get(mfaIpKey);
    const mfaAccountRes = await loginRateLimiter.get(mfaAccountKey);

    const fromOfficeNetwork = await isOfficeNetwork(ip);
    const isIpBlocked = !fromOfficeNetwork && (mfaIpRes && mfaIpRes.remainingPoints <= 0);
    const isAccountBlocked = mfaAccountRes && mfaAccountRes.remainingPoints <= 0;

    if (isIpBlocked || isAccountBlocked) {
      const maxRetry = Math.max(
        (!fromOfficeNetwork && mfaIpRes?.msBeforeNext) || 0,
        mfaAccountRes?.msBeforeNext || 0
      );
      const retryAfterSec = Math.ceil(maxRetry / 1000) || 60;
      return NextResponse.json(
        { error: `Too many MFA attempts. Try again in ${retryAfterSec} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const { code, fingerprint } = await request.json().catch(() => ({}));
    if (!code) return NextResponse.json({ error: 'Verification code required' }, { status: 400 });

    const table = session.role === 'admin' ? 'admin_users' : 'employees';
    const { data: user } = await supabaseAdmin
      .from(table)
      .select('mfa_secret')
      .eq('id', session.id)
      .single();

    if (!user?.mfa_secret) return NextResponse.json({ error: 'MFA not configured' }, { status: 400 });

    const decryptedSecret = decryptSecret(user.mfa_secret);
    const isValid = await verifyMFAToken(code, decryptedSecret);

    if (isValid) {
      const userAgent = request.headers.get('user-agent') || 'unknown';

      // Create active session in database (Fail Closed)
      const sessionRecord = await createActiveSession({
        userId: session.id,
        role: session.role,
        ipAddress: ip,
        userAgent,
        deviceFingerprint: fingerprint || undefined,
      });

      if (!sessionRecord) {
        return NextResponse.json({ error: 'Failed to initialize security session' }, { status: 500 });
      }

      // Clear rate limit counters on success
      await loginRateLimiter.delete(mfaIpKey);
      await loginRateLimiter.delete(mfaAccountKey);

      // Create full auth token
      const finalSession = { ...session };
      delete (finalSession as any).mfa_pending;
      delete (finalSession as any).mfa_attempts;
      
      const token = await createToken(finalSession);
      const response = NextResponse.json({ success: true, user: { id: session.id, role: session.role } });

      const cookieName = session.role === 'admin' ? 'admin-auth-token' : 'employee-auth-token';
      const maxAge = session.role === 'admin' ? 8 * 60 * 60 : 24 * 60 * 60;
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      });

      // Clear temp token
      response.cookies.delete('mfa-pending-token');

      await logAuditAction('LOGIN_MFA_SUCCESS', table, session.id, null, null, { id: session.id, role: session.role });
      return response;
    }

    // Increment attempts counter on failure
    const currentAttempts = (session.mfa_attempts as number) || 0;
    const newAttempts = currentAttempts + 1;

    // Consume points from rate limiters
    if (!fromOfficeNetwork) {
      await loginRateLimiter.consume(mfaIpKey).catch(() => null);
    }
    await loginRateLimiter.consume(mfaAccountKey).catch(() => null);

    if (newAttempts >= 3) {
      await logAuditAction('LOGIN_MFA_FAILED', table, session.id, null, { reason: 'MFA lockout', attempts: newAttempts }, { id: session.id, role: session.role });
      
      const failResponse = NextResponse.json({ error: 'Too many failed MFA attempts. Please log in again.' }, { status: 401 });
      failResponse.cookies.delete('mfa-pending-token');
      return failResponse;
    }

    // Keep the session token but update attempts count
    const updatedToken = await createToken({
      ...session,
      mfa_attempts: newAttempts
    });

    const failResponse = NextResponse.json({ 
      error: `Invalid verification code. ${3 - newAttempts} attempt(s) remaining.` 
    }, { status: 401 });

    failResponse.cookies.set('mfa-pending-token', updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60, // 5 minutes
    });

    await logAuditAction('LOGIN_MFA_FAILED', table, session.id, null, { reason: 'Invalid code', attempts: newAttempts }, { id: session.id, role: session.role });
    return failResponse;
  } catch (err) {
    console.error('MFA login error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'MFA verification failed' }, { status: 500 });
  }
}

