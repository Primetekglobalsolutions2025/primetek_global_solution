import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF Protection: Validate Origin / Referer for state-mutating requests
  if (pathname.startsWith('/api') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          console.warn(`[CSRF] Blocked request from unauthorized origin: ${origin} (host: ${host})`);
          return NextResponse.json({ error: 'Forbidden: CSRF validation failed' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Forbidden: Malformed Origin' }, { status: 403 });
      }
    } else {
      const referer = request.headers.get('referer');
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          if (refererUrl.host !== host) {
            console.warn(`[CSRF] Blocked request from unauthorized referer: ${referer} (host: ${host})`);
            return NextResponse.json({ error: 'Forbidden: CSRF validation failed' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'Forbidden: Malformed Referer' }, { status: 403 });
        }
      } else {
        // Neither Origin nor Referer is present — reject to prevent CSRF bypass
        console.warn(`[CSRF] Blocked request: both Origin and Referer headers are missing (host: ${host})`);
        return NextResponse.json({ error: 'Forbidden: Origin or Referer header required' }, { status: 403 });
      }
    }
  }

  // Define public routes that don't need auth
  const isPublicApiRoute = 
    pathname === '/api/auth/mfa-login' ||
    pathname === '/api/auth/unified-login' ||
    (pathname === '/api/inquiries' && request.method === 'POST') ||
    (pathname === '/api/applications' && request.method === 'POST');

  // 1. Admin route protection
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin-auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const session = await verifyToken(token);
    if (!session) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin-auth-token');
      return response;
    }
    if (session.role !== 'admin') {
      if (session.role === 'employee' || session.role === 'hr') {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 2. Employee route protection
  if (pathname.startsWith('/employee') && !pathname.startsWith('/employee/login')) {
    const token = request.cookies.get('employee-auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/employee/login', request.url));
    }

    const session = await verifyToken(token);
    if (!session) {
      const response = NextResponse.redirect(new URL('/employee/login', request.url));
      response.cookies.delete('employee-auth-token');
      return response;
    }
    if (session.role !== 'employee' && session.role !== 'hr') {
      if (session.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/employee/login', request.url));
    }

    // AUTH-02: Check if employee account is active
    const { data: empData } = await supabaseAdmin
      .from('employees')
      .select('status')
      .eq('id', session.id)
      .single();

    if (!empData || empData.status !== 'Active') {
      const response = NextResponse.redirect(new URL('/employee/login', request.url));
      response.cookies.delete('employee-auth-token');
      return response;
    }
  }

  // 3. API route protection
  if (pathname.startsWith('/api') && !isPublicApiRoute) {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Role-based API protection
    if (pathname.startsWith('/api/inquiries') && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Add more role checks as needed

    // AUTH-02: Check if employee account is active for non-admin API requests
    if (session.role !== 'admin') {
      const { data: empData } = await supabaseAdmin
        .from('employees')
        .select('status')
        .eq('id', session.id)
        .single();

      if (!empData || empData.status !== 'Active') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*', '/api/:path*'],
};
