import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    let token = request.cookies.get('auth-token')?.value;

    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

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

    // Restore HTTP-only cookie if it was missing from the request cookies
    if (!request.cookies.has('auth-token')) {
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('Session error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
