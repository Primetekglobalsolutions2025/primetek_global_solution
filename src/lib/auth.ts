import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { env } from './env';

let _jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (!_jwtSecret) {
    _jwtSecret = new TextEncoder().encode(env.JWT_SECRET);
  }
  return _jwtSecret;
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  name?: string;
  [key: string]: unknown;
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7-day sessions for security
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  let tokenCookieName: string | null = null;

  try {
    const headerStore = await headers();
    const referer = headerStore.get('referer');
    if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.pathname.startsWith('/admin')) {
        tokenCookieName = 'admin-auth-token';
      } else if (refererUrl.pathname.startsWith('/employee')) {
        tokenCookieName = 'employee-auth-token';
      }
    }
  } catch {
    // headers() might fail in some contexts
  }

  // If we couldn't determine from referer, try both but validate role matches
  if (!tokenCookieName) {
    // Try admin first, then employee — but verify role after
    const adminToken = cookieStore.get('admin-auth-token')?.value;
    if (adminToken) return verifyToken(adminToken);
    const empToken = cookieStore.get('employee-auth-token')?.value;
    if (empToken) return verifyToken(empToken);
    return null;
  }

  const token = cookieStore.get(tokenCookieName)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const { pathname, searchParams } = request.nextUrl;
  const referer = request.headers.get('referer');
  const roleParam = searchParams.get('role');
  
  // Strict cookie selection based on route path — no fallback across roles
  let tokenCookieName: string | null = null;
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) {
    tokenCookieName = 'admin-auth-token';
  } else if (pathname.startsWith('/api/attendance') || pathname.startsWith('/api/mfa') || pathname.startsWith('/employee')) {
    tokenCookieName = 'employee-auth-token';
  } else if (roleParam === 'admin') {
    tokenCookieName = 'admin-auth-token';
  } else if (roleParam === 'employee') {
    tokenCookieName = 'employee-auth-token';
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.pathname.startsWith('/admin')) {
        tokenCookieName = 'admin-auth-token';
      } else if (refererUrl.pathname.startsWith('/employee')) {
        tokenCookieName = 'employee-auth-token';
      }
    } catch {}
  }

  // If no route-based match, try both cookies (middleware will still enforce role)
  if (!tokenCookieName) {
    return request.cookies.get('admin-auth-token')?.value ||
           request.cookies.get('employee-auth-token')?.value ||
           null;
  }

  return request.cookies.get(tokenCookieName)?.value || null;
}

