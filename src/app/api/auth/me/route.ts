import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest, createToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    let responseUser = null;

    // If admin, they don't exist in employees table, so we use session data directly
    if (session.role === 'admin') {
      responseUser = {
        id: session.id,
        name: session.name || 'Administrator',
        role: 'admin',
        email: session.email
      };
    } else {
      // Fetch latest employee info from DB
      const { data: user, error } = await supabaseAdmin
        .from('employees')
        .select('id, name, role, email')
        .eq('id', session.id)
        .single();

      if (error || !user) {
        if (error && error.code === 'PGRST116') {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        console.warn('Transient DB fetch issue for employee, falling back to JWT session payload:', error);
        responseUser = {
          id: session.id,
          name: session.name || 'Employee',
          role: session.role || 'employee',
          email: session.email
        };
      } else {
        responseUser = {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email
        };
      }
    }

    const response = NextResponse.json({ user: responseUser });

    // Clear legacy auth-token if present
    if (request.cookies.has('auth-token')) {
      response.cookies.delete('auth-token');
    }

    const cookieName = responseUser.role === 'admin' ? 'admin-auth-token' : 'employee-auth-token';
    const maxAge = responseUser.role === 'admin' ? 8 * 60 * 60 : 24 * 60 * 60;

    // Silent token refresh: if token expires within 1 hour, issue a fresh one
    const exp = session.exp as number | undefined;
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp && (exp - nowSec) < 3600) {
      // Strip JWT-specific claims before re-signing
      const { exp: _exp, iat: _iat, ...payload } = session as any;
      const refreshedToken = await createToken(payload);
      response.cookies.set(cookieName, refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      });
    } else if (!request.cookies.has(cookieName)) {
      // Restore HTTP-only cookie if it was missing from the request cookies
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('Session error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
