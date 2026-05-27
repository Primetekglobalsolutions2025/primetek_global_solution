import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { verifyMFAToken, decryptSecret } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loginRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'MFA code is required' }, { status: 400 });

    const rateLimitKey = `mfa-verify:${session.id}`;
    const rateLimitResult = await consumeRateLimit(loginRateLimiter, rateLimitKey);
    if (!rateLimitResult.allowed) {
      const retryAfterSec = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many verification attempts. Please try again after ${retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const table = session.role === 'admin' ? 'admin_users' : 'employees';
    const { data: user, error: fetchError } = await supabaseAdmin
      .from(table)
      .select('mfa_secret')
      .eq('id', session.id)
      .single();

    if (fetchError || !user?.mfa_secret) {
      return NextResponse.json({ error: 'MFA not set up' }, { status: 400 });
    }

    const decryptedSecret = decryptSecret(user.mfa_secret);
    const isValid = await verifyMFAToken(code, decryptedSecret);

    if (isValid) {
      // Clear rate limit
      await loginRateLimiter.delete(rateLimitKey);

      // Enable MFA formally
      await supabaseAdmin
        .from(table)
        .update({ mfa_enabled: true })
        .eq('id', session.id);

      return NextResponse.json({ success: true, message: 'MFA enabled successfully' });
    }

    return NextResponse.json({ error: 'Invalid MFA code' }, { status: 401 });
  } catch (err) {
    console.error('MFA Verify error:', err);
    return NextResponse.json({ error: 'Failed to verify MFA code' }, { status: 500 });
  }
}
