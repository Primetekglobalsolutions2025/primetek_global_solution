import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';
import { verifyMFAToken } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const tempToken = request.cookies.get('mfa-pending-token')?.value;
    if (!tempToken) return NextResponse.json({ error: 'MFA session expired' }, { status: 401 });

    const session = await verifyToken(tempToken);
    if (!session || !session.mfa_pending) {
      return NextResponse.json({ error: 'Invalid MFA session' }, { status: 401 });
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

    const isValid = await verifyMFAToken(code, user.mfa_secret);

    if (isValid) {
      // Create full auth token
      const finalSession = { ...session };
      delete (finalSession as any).mfa_pending;
      
      const token = await createToken(finalSession);
      const response = NextResponse.json({ success: true, user: { id: session.id, role: session.role } });

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      // Clear temp token
      response.cookies.delete('mfa-pending-token');

      return response;
    }

    return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
  } catch (err) {
    console.error('MFA login error:', err);
    return NextResponse.json({ error: 'MFA verification failed' }, { status: 500 });
  }
}
