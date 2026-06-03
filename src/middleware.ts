import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface CacheEntry {
  status: string | null;
  timestamp: number;
}

const statusCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function getCachedEmployeeStatus(employeeId: string): Promise<string | null> {
  const now = Date.now();
  const cached = statusCache.get(employeeId);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.status;
  }

  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      const { data: empData, error } = await supabaseAdmin
        .from('employees')
        .select('status')
        .eq('id', employeeId)
        .single();

      if (error) throw error;

      // Check if a valid session exists in active_sessions table
      const { data: activeSession, error: sessionError } = await supabaseAdmin
        .from('active_sessions')
        .select('id')
        .eq('user_id', employeeId)
        .eq('is_valid', true)
        .limit(1)
        .maybeSingle();

      if (sessionError) throw sessionError;

      // If employee is active in DB but has no valid active session, treat as Revoked
      const status = (!activeSession && empData?.status === 'Active') ? 'Revoked' : (empData?.status || null);
      
      if (statusCache.size >= 500) {
        statusCache.clear();
      }
      statusCache.set(employeeId, { status, timestamp: now });
      return status;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        console.error(`[Middleware Cache Retry] Failed to fetch employee status after ${attempts} attempts:`, err);
        throw err; // Fail closed by throwing error to caller
      }
      // Backoff delay: 100ms, 200ms
      await new Promise((res) => setTimeout(res, attempts * 100));
    }
  }
  return null;
}

interface AdminCacheEntry {
  exists: boolean;
  timestamp: number;
}

const adminCache = new Map<string, AdminCacheEntry>();

async function getCachedAdminExistence(adminId: string): Promise<boolean> {
  const now = Date.now();
  const cached = adminCache.get(adminId);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.exists;
  }

  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      const { data: adminData, error } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('id', adminId)
        .maybeSingle();

      if (error) throw error;

      // Check if a valid session exists in active_sessions table
      const { data: activeSession, error: sessionError } = await supabaseAdmin
        .from('active_sessions')
        .select('id')
        .eq('user_id', adminId)
        .eq('is_valid', true)
        .limit(1)
        .maybeSingle();

      if (sessionError) throw sessionError;

      const exists = !!adminData && !!activeSession;
      if (adminCache.size >= 500) {
        adminCache.clear();
      }
      adminCache.set(adminId, { exists, timestamp: now });
      return exists;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        console.error(`[Middleware Cache Retry] Failed to fetch admin existence after ${attempts} attempts:`, err);
        throw err; // Fail closed by throwing error to caller
      }
      // Backoff delay: 100ms, 200ms
      await new Promise((res) => setTimeout(res, attempts * 100));
    }
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);

  const runMiddleware = async (): Promise<NextResponse> => {
    const { pathname } = request.nextUrl;
    requestHeaders.set('x-pathname', pathname);

    // CSRF Protection: Validate Origin / Referer for state-mutating requests
    // Exempt /api/extension endpoints since they use JWT headers and are immune to CSRF
    const isExtensionRoute = pathname.startsWith('/api/extension');

    if (!isExtensionRoute && pathname.startsWith('/api') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
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
      pathname === '/api/extension/auth' ||
      (pathname === '/api/inquiries' && request.method === 'POST') ||
      (pathname === '/api/applications' && request.method === 'POST');

    // Redirect already logged-in users trying to access login page
    if (pathname === '/admin/login') {
      const token = request.cookies.get('admin-auth-token')?.value;
      if (token) {
        const session = await verifyToken(token);
        if (session && session.role === 'admin') {
          try {
            const adminExists = await getCachedAdminExistence(session.id);
            if (adminExists) {
              return NextResponse.redirect(new URL('/admin/dashboard', request.url));
            }
          } catch (err) {
            console.error('[Security Guard] Already logged in check failed for admin:', err);
          }
        }
      }
    }

    if (pathname === '/employee/login') {
      const token = request.cookies.get('employee-auth-token')?.value;
      if (token) {
        const session = await verifyToken(token);
        if (session && (session.role === 'employee' || session.role === 'hr')) {
          try {
            const empStatus = await getCachedEmployeeStatus(session.id);
            if (empStatus === 'Active') {
              return NextResponse.redirect(new URL('/employee/dashboard', request.url));
            }
          } catch (err) {
            console.error('[Security Guard] Already logged in check failed for employee:', err);
          }
        }
      }
    }

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

      // Check if admin account still exists in DB (Fail Closed)
      try {
        const adminExists = await getCachedAdminExistence(session.id);
        if (!adminExists) {
          console.warn(`[Security Guard] Admin user ID ${session.id} no longer exists in database.`);
          const response = NextResponse.redirect(new URL('/admin/login?error=revoked', request.url));
          response.cookies.delete('admin-auth-token');
          return response;
        }
      } catch (err) {
        console.error('[Security Guard] Admin account existence check failed closed:', err);
        const response = NextResponse.redirect(new URL('/admin/login?error=db_error', request.url));
        response.cookies.delete('admin-auth-token');
        return response;
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

      // AUTH-02: Check if employee account is active (Fail Closed)
      try {
        const empStatus = await getCachedEmployeeStatus(session.id);
        if (empStatus !== 'Active') {
          console.warn(`[Security Guard] Employee user ID ${session.id} status is ${empStatus}. Blocking access.`);
          const response = NextResponse.redirect(new URL('/employee/login?error=inactive', request.url));
          response.cookies.delete('employee-auth-token');
          return response;
        }
      } catch (err) {
        console.error('[Security Guard] Employee status check failed closed:', err);
        const response = NextResponse.redirect(new URL('/employee/login?error=db_error', request.url));
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

      // Fail Closed API checks
      try {
        if (session.role !== 'admin') {
          const empStatus = await getCachedEmployeeStatus(session.id);
          if (empStatus !== 'Active') {
            return NextResponse.json({ error: 'Unauthorized: Account status not active' }, { status: 401 });
          }
        } else {
          const adminExists = await getCachedAdminExistence(session.id);
          if (!adminExists) {
            return NextResponse.json({ error: 'Unauthorized: Admin account not active' }, { status: 401 });
          }
        }
      } catch (err) {
        console.error('[Security Guard] API verification check failed closed:', err);
        return NextResponse.json({ error: 'Security verification database unavailable' }, { status: 500 });
      }
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };

  const response = await runMiddleware();
  response.headers.set('x-correlation-id', correlationId);
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*', '/api/:path*'],
};
