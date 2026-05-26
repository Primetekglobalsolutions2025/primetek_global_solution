import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  // Invalidate database active sessions for this user
  try {
    const userSession = await getSession();
    if (userSession && userSession.id) {
      await supabaseAdmin
        .from('active_sessions')
        .update({ is_valid: false })
        .eq('user_id', userSession.id)
        .eq('is_valid', true);
    }
  } catch (err) {
    console.warn('Failed to invalidate session in database during logout:', err instanceof Error ? err.message : String(err));
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
  response.cookies.set('auth-token', '', cookieOptions);
  response.cookies.set('admin-auth-token', '', cookieOptions);
  response.cookies.set('employee-auth-token', '', cookieOptions);
  response.cookies.set('mfa-pending-token', '', cookieOptions); // LOW-11
  return response;
}

