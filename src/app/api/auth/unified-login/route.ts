import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken, createCaptchaToken, verifyCaptchaToken } from '@/lib/auth';
import { createActiveSession } from '@/lib/security/session-tracker';
import bcrypt from 'bcryptjs';
import { loginRateLimiter, CAPTCHA_THRESHOLD } from '@/lib/rate-limit';
import { logAuditAction } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    // 1. Basic Security: Rate Limiting by IP
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as any).ip || 'unknown-ip';
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth] Attempt from IP: ${ip}`);
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { email, password, fingerprint } = body;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Basic Security: Check if blocked by Rate Limiter
    const rateLimitKey = `${ip}_${cleanEmail}`;
    const rateLimitRes = await loginRateLimiter.get(rateLimitKey);
    if (rateLimitRes && rateLimitRes.remainingPoints <= 0) {
      return NextResponse.json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.',
        lockout: true 
      }, { status: 429 });
    }

    const failedAttempts = rateLimitRes ? (5 - rateLimitRes.remainingPoints) : 0;
    const isCaptchaRequired = failedAttempts >= CAPTCHA_THRESHOLD;

    if (isCaptchaRequired) {
      const { captchaToken, captchaAnswer, captchaNonce } = body || {};
      if (!captchaToken || captchaAnswer === undefined || captchaAnswer === null || !captchaNonce) {
        const captcha = await generateCaptchaChallenge();
        return NextResponse.json({
          error: 'Security verification required. Please solve the CAPTCHA.',
          showCaptcha: true,
          captcha
        }, { status: 401 });
      }

      const isValid = await verifyCaptchaToken(captchaToken, Number(captchaAnswer), captchaNonce);
      if (!isValid) {
        const captcha = await generateCaptchaChallenge();
        return NextResponse.json({
          error: 'Incorrect CAPTCHA answer. Please try again.',
          showCaptcha: true,
          captcha
        }, { status: 401 });
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth] Login attempt for: ${cleanEmail}`);
    }

    const isEmail = cleanEmail.includes('@');

    // 3. Admin Check (Database-first for reliability)
    // First, check if this email exists in the admin_users table
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('id, email')
      .ilike('email', cleanEmail)
      .single();

    const ADMIN_EMAIL_ENV = (process.env.ADMIN_EMAIL || 'admin@primetekglobalsolutions.com').trim().toLowerCase();
    const isAdmin = adminRecord || cleanEmail === ADMIN_EMAIL_ENV;

    if (isAdmin) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Auth] Admin detected (${cleanEmail}). Authenticating via Supabase Auth...`);
      } else {
        console.log('[Auth] Admin login attempt. Authenticating via Supabase Auth...');
      }
      
      const { data: authData, error: apiAuthError } = await supabaseAdmin.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (apiAuthError) {
        console.error('[Auth] Admin Auth failed:', apiAuthError.message);
        
        const currentRes = await loginRateLimiter.consume(rateLimitKey).catch(err => err);
        const failedAttempts = 5 - (currentRes.remainingPoints || 0);
        const responseData: { error: string; showCaptcha?: boolean; captcha?: { equation: string; token: string; nonce: string } } = { error: 'Invalid credentials' };
        if (failedAttempts >= CAPTCHA_THRESHOLD) {
          responseData.showCaptcha = true;
          responseData.captcha = await generateCaptchaChallenge();
        }
        
        // Pass through specific errors that aren't just "wrong password"
        if (apiAuthError.message !== 'Invalid login credentials') {
          responseData.error = apiAuthError.message;
        }
        
        return NextResponse.json(responseData, { status: 401 });
      }

      if (authData?.user) {
        // Clear rate limit key on success
        await loginRateLimiter.delete(rateLimitKey);
        // Verify admin is provisioned in admin_users table
        const { data: freshAdmin, error: freshAdminError } = await supabaseAdmin
          .from('admin_users')
          .select('mfa_enabled')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (freshAdminError || !freshAdmin) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (freshAdmin?.mfa_enabled) {
          const tempToken = await createToken({
            id: authData.user.id,
            email: authData.user.email || email,
            role: 'admin',
            name: authData.user.user_metadata?.full_name || 'Administrator',
            mfa_pending: true,
          });

          const response = NextResponse.json({ 
            requiresMFA: true,
            role: 'admin'
          });

          response.cookies.set('mfa-pending-token', tempToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 5 * 60, // 5 minutes
          });

          await logAuditAction('LOGIN_MFA_PENDING', 'admin_users', authData.user.id, null, null, { id: authData.user.id, role: 'admin' });
          return response;
        }

        // Create active session in database (Fail Closed)
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const sessionRecord = await createActiveSession({
          userId: authData.user.id,
          role: 'admin',
          ipAddress: ip,
          userAgent,
          deviceFingerprint: fingerprint || undefined,
        });

        if (!sessionRecord) {
          return NextResponse.json({ error: 'Failed to initialize security session' }, { status: 500 });
        }

        const token = await createToken({
          id: authData.user.id,
          email: authData.user.email || email,
          role: 'admin',
          name: authData.user.user_metadata?.full_name || 'Administrator',
        });

        const response = NextResponse.json({ 
          success: true, 
          role: 'admin',
          name: authData.user.user_metadata?.full_name || 'Administrator' 
        });

        response.cookies.set('admin-auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 8 * 60 * 60, // 8 hours (admin session lifetime)
        });

        response.cookies.delete('mfa-pending-token');

        await logAuditAction('LOGIN_SUCCESS', 'admin_users', authData.user.id, null, null, { id: authData.user.id, role: 'admin' });
        return response;
      }
    }

    // 4. If not admin, try finding the user in the employees table
    const query = supabaseAdmin
      .from('employees')
      .select('id, email, employee_id, password_hash, status, name, role, mfa_enabled');
      
    const { data: user, error } = await (isEmail 
      ? query.ilike('email', cleanEmail).single() 
      : query.ilike('employee_id', cleanEmail).single());

    if (error || !user) {
      const currentRes = await loginRateLimiter.consume(rateLimitKey).catch(err => err);
      const failedAttempts = 5 - (currentRes.remainingPoints || 0);
      const responseData: { error: string; showCaptcha?: boolean; captcha?: { equation: string; token: string; nonce: string } } = { error: 'Invalid credentials' };
      if (failedAttempts >= CAPTCHA_THRESHOLD) {
        responseData.showCaptcha = true;
        responseData.captcha = await generateCaptchaChallenge();
      }
      return NextResponse.json(responseData, { status: 401 });
    }

    if (user.status !== 'Active') {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    const isValidPassword = await bcrypt.compare(cleanPassword, user.password_hash);
    if (!isValidPassword) {
      await logAuditAction('LOGIN_FAILED', 'employees', user.id, null, { reason: 'Incorrect password', email: cleanEmail }, { id: user.id, role: user.role });
      
      const currentRes = await loginRateLimiter.consume(rateLimitKey).catch(err => err);
      const failedAttempts = 5 - (currentRes.remainingPoints || 0);
      const responseData: { error: string; showCaptcha?: boolean; captcha?: { equation: string; token: string; nonce: string } } = { error: 'Invalid credentials' };
      if (failedAttempts >= CAPTCHA_THRESHOLD) {
        responseData.showCaptcha = true;
        responseData.captcha = await generateCaptchaChallenge();
      }
      return NextResponse.json(responseData, { status: 401 });
    }

    // Clear rate limit key on success
    await loginRateLimiter.delete(rateLimitKey);

    if (user.mfa_enabled) {
      const tempToken = await createToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        mfa_pending: true,
      });

      const response = NextResponse.json({ 
        requiresMFA: true,
        role: user.role
      });

      response.cookies.set('mfa-pending-token', tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 5 * 60, // 5 minutes
      });

      await logAuditAction('LOGIN_MFA_PENDING', 'employees', user.id, null, null, { id: user.id, role: user.role });
      return response;
    }

    // Create active session in database (Fail Closed)
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const sessionRecord = await createActiveSession({
      userId: user.id,
      role: user.role,
      ipAddress: ip,
      userAgent,
      deviceFingerprint: fingerprint || undefined,
    });

    if (!sessionRecord) {
      return NextResponse.json({ error: 'Failed to initialize security session' }, { status: 500 });
    }

    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({ 
      success: true, 
      role: user.role,
      name: user.name 
    });

    response.cookies.set('employee-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours (employee session lifetime)
    });

    response.cookies.delete('mfa-pending-token');

    await logAuditAction('LOGIN_SUCCESS', 'employees', user.id, null, null, { id: user.id, role: user.role });
    return response;
  } catch (err) {
    console.error('Unified Login error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateCaptchaChallenge() {
  const num1 = Math.floor(Math.random() * 11) + 2; // 2 to 12
  const num2 = Math.floor(Math.random() * 11) + 2; // 2 to 12
  const equation = `${num1} × ${num2}`;
  const nonce = crypto.randomUUID();
  const token = await createCaptchaToken(num1 * num2, nonce);
  return { equation, token, nonce };
}
