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
  let tokenCookieName = 'auth-token';

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
    // headers() might fail in some contexts, fall back to safe check
  }

  let token = cookieStore.get(tokenCookieName)?.value;
  if (!token) {
    const alternativeCookie = tokenCookieName === 'admin-auth-token' ? 'employee-auth-token' : 'admin-auth-token';
    token = cookieStore.get(alternativeCookie)?.value;
  }
  if (!token) {
    token = cookieStore.get('auth-token')?.value;
  }

  if (!token) return null;
  return verifyToken(token);
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const { pathname, searchParams } = request.nextUrl;
  const referer = request.headers.get('referer');
  const roleParam = searchParams.get('role');
  
  let tokenCookieName = 'auth-token';
  if (pathname.startsWith('/api/admin')) {
    tokenCookieName = 'admin-auth-token';
  } else if (pathname.startsWith('/api/attendance')) {
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

  let token = request.cookies.get(tokenCookieName)?.value;
  if (!token) {
    const alternativeCookie = tokenCookieName === 'admin-auth-token' ? 'employee-auth-token' : 'admin-auth-token';
    token = request.cookies.get(alternativeCookie)?.value;
  }
  if (!token) {
    token = request.cookies.get('auth-token')?.value;
  }
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  return token || null;
}

