import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';
import { verifyMFAToken, decryptSecret } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAuditAction } from '@/lib/audit';
import { loginRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const tempToken = request.cookies.get('mfa-pending-token')?.value;
    if (!tempToken) return NextResponse.json({ error: 'MFA session expired' }, { status: 401 });

    const session = await verifyToken(tempToken);
    if (!session || !session.mfa_pending) {
      return NextResponse.json({ error: 'Invalid MFA session' }, { status: 401 });
    }

    // Rate limit MFA verification attempts to prevent brute-forcing 6-digit codes
    const rateLimitKey = `mfa:${session.id}`;
    const rateLimitResult = await consumeRateLimit(loginRateLimiter, rateLimitKey);
    if (!rateLimitResult.allowed) {
      const retryAfterSec = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many MFA attempts. Try again in ${retryAfterSec} seconds.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const { code } = await request.json();
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
      // Create full auth token
      const finalSession = { ...session };
      delete (finalSession as any).mfa_pending;
      
      const token = await createToken(finalSession);
      const response = NextResponse.json({ success: true, user: { id: session.id, role: session.role } });

      const cookieName = session.role === 'admin' ? 'admin-auth-token' : 'employee-auth-token';
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      // Clear temp token
      response.cookies.delete('mfa-pending-token');

      await logAuditAction('LOGIN_MFA_SUCCESS', table, session.id, null, null, { id: session.id, role: session.role });
      return response;
    }

    await logAuditAction('LOGIN_MFA_FAILED', table, session.id, null, { reason: 'Invalid code' }, { id: session.id, role: session.role });
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
  } catch (err) {
    console.error('MFA login error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'MFA verification failed' }, { status: 500 });
  }
}
