import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public routes that don't need auth
  const isPublicApiRoute = 
    pathname === '/api/auth/login' || 
    pathname === '/api/auth/employee-login' ||
    (pathname === '/api/inquiries' && request.method === 'POST') ||
    (pathname === '/api/applications' && request.method === 'POST') ||
    pathname === '/api/jobs' ||
    pathname.startsWith('/api/jobs/');

  // 1. Admin route protection
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const session = await verifyToken(token);
    if (!session) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 2. Employee route protection
  if (pathname.startsWith('/employee') && !pathname.startsWith('/employee/login')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/employee/login', request.url));
    }

    const session = await verifyToken(token);
    if (!session) {
      const response = NextResponse.redirect(new URL('/employee/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
    if (session.role !== 'employee' && session.role !== 'hr') {
      return NextResponse.redirect(new URL('/employee/login', request.url));
    }
  }

  // 3. API route protection
  if (pathname.startsWith('/api') && !isPublicApiRoute) {
    const token = request.cookies.get('auth-token')?.value;

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
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*', '/api/:path*'],
};
