import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { env } from './env';
import { supabaseAdmin } from './supabase-admin';

export async function verifyActiveSession(employeeId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('status')
    .eq('id', employeeId)
    .single();
  if (error || !data || data.status !== 'Active') {
    throw new Error('Unauthorized: Account is inactive or deleted.');
  }

  const { data: activeSession, error: sessionError } = await supabaseAdmin
    .from('active_sessions')
    .select('id')
    .eq('user_id', employeeId)
    .eq('is_valid', true)
    .limit(1)
    .maybeSingle();

  if (sessionError || !activeSession) {
    throw new Error('Unauthorized: Session has been revoked or expired.');
  }
}

const adminExistenceCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000;

export async function verifyActiveAdmin(adminId: string): Promise<void> {
  const now = Date.now();
  const cached = adminExistenceCache.get(adminId);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    if (!cached.exists) {
      throw new Error('Unauthorized: Admin account is inactive, deleted, or session revoked.');
    }
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('id', adminId)
    .maybeSingle();

  const { data: activeSession, error: sessionError } = await supabaseAdmin
    .from('active_sessions')
    .select('id')
    .eq('user_id', adminId)
    .eq('is_valid', true)
    .limit(1)
    .maybeSingle();

  const exists = !!data && !error && !!activeSession && !sessionError;

  if (adminExistenceCache.size >= 500) {
    adminExistenceCache.clear();
  }
  adminExistenceCache.set(adminId, { exists, timestamp: now });

  if (!exists) {
    throw new Error('Unauthorized: Admin account is inactive, deleted, or session revoked.');
  }
}

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
  // Admin tokens expire in 8 hours (one shift), employee/HR in 24 hours
  const expiration = payload.role === 'admin' ? '8h' : '24h';
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiration)
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

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

let _captchaKey: CryptoKey | null = null;
async function getCaptchaKey(): Promise<CryptoKey> {
  if (!_captchaKey) {
    const secretBuffer = new TextEncoder().encode(env.JWT_SECRET);
    const keyBuffer = await crypto.subtle.digest('SHA-256', secretBuffer);
    _captchaKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }
  return _captchaKey;
}

export async function createCaptchaToken(answer: number, nonce: string): Promise<string> {
  const payload = JSON.stringify({ answer, nonce, expiry: Date.now() + 5 * 60 * 1000 });
  const aesKey = await getCaptchaKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payloadBuffer = new TextEncoder().encode(payload);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    payloadBuffer as unknown as BufferSource
  );

  return `${bufToHex(iv.buffer)}:${bufToHex(encrypted)}`;
}

export async function verifyCaptchaToken(token: string, submittedAnswer: number, expectedNonce: string): Promise<boolean> {
  try {
    const parts = token.split(':');
    if (parts.length !== 2) return false;
    const [ivHex, cipherHex] = parts;
    if (!ivHex || !cipherHex) return false;

    const iv = hexToBuf(ivHex);
    const cipher = hexToBuf(cipherHex);
    const aesKey = await getCaptchaKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      aesKey,
      cipher as unknown as BufferSource
    );

    const payloadStr = new TextDecoder().decode(decrypted);
    const payload = JSON.parse(payloadStr);

    if (typeof payload.answer !== 'number' || typeof payload.expiry !== 'number' || typeof payload.nonce !== 'string') return false;
    if (Date.now() > payload.expiry) return false;
    return payload.answer === submittedAnswer && payload.nonce === expectedNonce;
  } catch (err) {
    console.error('[Captcha Verify] Cryptographic error:', err);
    return false;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  let tokenCookieName: string | null = null;

  try {
    const headerStore = await headers();
    let pathname = headerStore.get('x-pathname') || '';

    if (!pathname) {
      const referer = headerStore.get('referer');
      const nextUrl = headerStore.get('next-url');

      if (nextUrl) {
        pathname = nextUrl;
      } else if (referer) {
        try {
          pathname = new URL(referer).pathname;
        } catch {}
      }
    }

    if (pathname) {
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        tokenCookieName = 'admin-auth-token';
      } else if (pathname.startsWith('/employee') || pathname.startsWith('/api/attendance') || pathname.startsWith('/api/mfa') || pathname.startsWith('/api/auth')) {
        tokenCookieName = 'employee-auth-token';
      }
    }
  } catch {
    // headers() might fail in some contexts
  }

  // If we couldn't determine from headers, try both but validate role matches
  if (!tokenCookieName) {
    const adminToken = cookieStore.get('admin-auth-token')?.value;
    if (adminToken) {
      const payload = await verifyToken(adminToken);
      if (payload && payload.role === 'admin') return payload;
    }
    const empToken = cookieStore.get('employee-auth-token')?.value;
    if (empToken) {
      const payload = await verifyToken(empToken);
      if (payload && (payload.role === 'employee' || payload.role === 'hr')) return payload;
    }
    return null;
  }

  const token = cookieStore.get(tokenCookieName)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) return payload;
  }

  // Fallback: Verify both cookies if the specific one is missing or verification failed
  const adminToken = cookieStore.get('admin-auth-token')?.value;
  if (adminToken) {
    const payload = await verifyToken(adminToken);
    if (payload && payload.role === 'admin') return payload;
  }
  const empToken = cookieStore.get('employee-auth-token')?.value;
  if (empToken) {
    const payload = await verifyToken(empToken);
    if (payload && (payload.role === 'employee' || payload.role === 'hr')) return payload;
  }
  return null;
}

export function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first (standard Bearer token for API/Extension clients)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

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

