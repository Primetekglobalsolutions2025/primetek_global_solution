import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken, createCaptchaToken, verifyCaptchaToken } from '@/lib/auth';
import { createActiveSession } from '@/lib/security/session-tracker';
import bcrypt from 'bcryptjs';
import { loginRateLimiter, CAPTCHA_THRESHOLD } from '@/lib/rate-limit';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { isOfficeNetwork } from '@/lib/security/network-trust';

async function recordFailedAttempt(ipKey: string, accountKey: string, fromOfficeNetwork: boolean) {
  if (!fromOfficeNetwork) {
    await loginRateLimiter.consume(ipKey).catch(() => null);
  }
  await loginRateLimiter.consume(accountKey).catch(() => null);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Basic Security: Extract IP and parse request body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as any).ip || 'unknown-ip';

    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { email, password, fingerprint, portal } = body;
    
    // Validate portal parameter explicitly
    if (portal !== 'admin' && portal !== 'employee') {
      // Dummy bcrypt operation to prevent timing attacks
      await bcrypt.compare(password, '$2a$12$L8n8GvU.Y2d7b4OdfGkY3.2SDFs67asdfaHsklj123HjkasdfHj12');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 2. Dual-Layer Rate Limiting (IP-based and Account-based)
    const ipKey = `ip:${ip}`;
    const accountKey = `account:${cleanEmail}`;

    const ipRateLimitRes = await loginRateLimiter.get(ipKey);
    const accountRateLimitRes = await loginRateLimiter.get(accountKey);

    // If request comes from the office network (shared WiFi), skip IP-based blocking.
    // All employees share the same public IP — blocking by IP would lock out the entire office.
    // External IPs (home, mobile data) are still blocked by IP after 5 failed attempts.
    const fromOfficeNetwork = await isOfficeNetwork(ip);

    const isIpBlocked = !fromOfficeNetwork && (ipRateLimitRes && ipRateLimitRes.remainingPoints <= 0);
    const isAccountBlocked = accountRateLimitRes && accountRateLimitRes.remainingPoints <= 0;

    if (isIpBlocked || isAccountBlocked) {
      return NextResponse.json({ 
        error: isAccountBlocked
          ? 'Too many failed attempts for this account. Please try again in 15 minutes.'
          : 'Too many failed attempts from your network. Please try again in 15 minutes.',
        lockout: true 
      }, { status: 429 });
    }

    // For CAPTCHA threshold: use account-based count for office network, IP-based for external
    const ipFailed = ipRateLimitRes ? (5 - ipRateLimitRes.remainingPoints) : 0;
    const accountFailed = accountRateLimitRes ? (5 - accountRateLimitRes.remainingPoints) : 0;
    const maxFailedAttempts = fromOfficeNetwork ? accountFailed : Math.max(ipFailed, accountFailed);
    const isCaptchaRequired = maxFailedAttempts >= CAPTCHA_THRESHOLD;

    if (isCaptchaRequired) {
      const { captchaToken, captchaAnswer, captchaNonce } = body || {};
      if (!captchaToken || captchaAnswer === undefined || captchaAnswer === null || !captchaNonce) {
        // Increment rate limit attempts for missing captcha
        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);
        const captcha = await generateCaptchaChallenge();
        return NextResponse.json({
          error: 'Security verification required. Please solve the CAPTCHA.',
          showCaptcha: true,
          captcha
        }, { status: 401 });
      }

      const isValid = await verifyCaptchaToken(captchaToken, Number(captchaAnswer), captchaNonce);
      if (!isValid) {
        // Increment rate limit attempts for incorrect captcha
        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);
        const captcha = await generateCaptchaChallenge();
        return NextResponse.json({
          error: 'Incorrect CAPTCHA answer. Please try again.',
          showCaptcha: true,
          captcha
        }, { status: 401 });
      }
    }

    // 3. ADMIN PORTAL PIPELINE
    if (portal === 'admin') {
      // Admin lookup - database-first
      const { data: record, error: dbErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (dbErr || !record) {
        // Admin does not exist: Run mock credentials verification to match timing
        const dummyClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
        await dummyClient.auth.signInWithPassword({
          email: 'nonexistent-admin-trigger-dummy@primetekglobalsolutions.com',
          password: 'dummy-password-that-will-fail-and-simulate-supabase-latency',
        }).catch(() => null);

        // Internal audit log for role/user mismatch
        await logAuditAction('LOGIN_FAILED', 'admin_users', '00000000-0000-0000-0000-000000000000', null, { 
          reason: 'invalid_role', 
          email: cleanEmail,
          portal: 'admin'
        });

        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);

        const currentRes = await loginRateLimiter.get(ipKey);
        const failedAttempts = 5 - (currentRes?.remainingPoints || 5);
        const responseData: { error: string; showCaptcha?: boolean; captcha?: any } = { error: 'Invalid credentials' };
        if (failedAttempts >= CAPTCHA_THRESHOLD) {
          responseData.showCaptcha = true;
          responseData.captcha = await generateCaptchaChallenge();
        }
        return NextResponse.json(responseData, { status: 401 });
      }

      // Authenticate with Supabase Auth
      const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: authData, error: apiAuthError } = await authClient.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (apiAuthError) {
        await logAuditAction('LOGIN_FAILED', 'admin_users', record.id, null, { 
          reason: 'invalid_password', 
          email: cleanEmail 
        }, { id: record.id, role: 'admin' });

        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);

        const currentRes = await loginRateLimiter.get(ipKey);
        const failedAttempts = 5 - (currentRes?.remainingPoints || 5);
        const responseData: { error: string; showCaptcha?: boolean; captcha?: any } = { error: 'Invalid credentials' };
        if (failedAttempts >= CAPTCHA_THRESHOLD) {
          responseData.showCaptcha = true;
          responseData.captcha = await generateCaptchaChallenge();
        }
        return NextResponse.json(responseData, { status: 401 });
      }

      if (authData?.user) {
        // Double check admin provisioning in database
        const { data: freshAdmin, error: freshAdminError } = await supabaseAdmin
          .from('admin_users')
          .select('mfa_enabled')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (freshAdminError || !freshAdmin) {
          await logAuditAction('LOGIN_FAILED', 'admin_users', authData.user.id, null, { 
            reason: 'invalid_role', 
            email: cleanEmail 
          }, { id: authData.user.id, role: 'admin' });

          await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);
          return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Handle MFA
        if (freshAdmin.mfa_enabled) {
          const tempToken = await createToken({
            id: authData.user.id,
            email: authData.user.email || email,
            role: 'admin',
            name: authData.user.user_metadata?.full_name || 'Administrator',
            mfa_pending: true,
            mfa_attempts: 0
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

        // Clear rate limit key on success
        await loginRateLimiter.delete(ipKey);
        await loginRateLimiter.delete(accountKey);

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

    // 4. EMPLOYEE PORTAL PIPELINE
    if (portal === 'employee') {
      const isEmail = cleanEmail.includes('@');
      
      const query = supabaseAdmin
        .from('employees')
        .select('id, email, employee_id, password_hash, status, name, role, mfa_enabled');
        
      const { data: user, error: dbErr } = await (isEmail 
        ? query.ilike('email', cleanEmail).maybeSingle() 
        : query.ilike('employee_id', cleanEmail).maybeSingle());

      if (dbErr || !user) {
        // Timing attack resistance: Run mock bcrypt compare
        await bcrypt.compare(cleanPassword, '$2a$12$L8n8GvU.Y2d7b4OdfGkY3.2SDFs67asdfaHsklj123HjkasdfHj12');

        // Internal audit log for missing user
        await logAuditAction('LOGIN_FAILED', 'employees', '00000000-0000-0000-0000-000000000000', null, { 
          reason: 'invalid_user', 
          email: cleanEmail,
          portal: 'employee'
        });

        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);

        const currentRes = await loginRateLimiter.get(ipKey);
        const failedAttempts = 5 - (currentRes?.remainingPoints || 5);
        const responseData: { error: string; showCaptcha?: boolean; captcha?: any } = { error: 'Invalid credentials' };
        if (failedAttempts >= CAPTCHA_THRESHOLD) {
          responseData.showCaptcha = true;
          responseData.captcha = await generateCaptchaChallenge();
        }
        return NextResponse.json(responseData, { status: 401 });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(cleanPassword, user.password_hash);
      if (!isValidPassword) {
        await logAuditAction('LOGIN_FAILED', 'employees', user.id, null, { 
          reason: 'invalid_password', 
          email: cleanEmail 
        }, { id: user.id, role: user.role });
        
        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);

        const currentRes = await loginRateLimiter.get(ipKey);
        const failedAttempts = 5 - (currentRes?.remainingPoints || 5);
        const responseData: { error: string; showCaptcha?: boolean; captcha?: any } = { error: 'Invalid credentials' };
        if (failedAttempts >= CAPTCHA_THRESHOLD) {
          responseData.showCaptcha = true;
          responseData.captcha = await generateCaptchaChallenge();
        }
        return NextResponse.json(responseData, { status: 401 });
      }

      // Verify account status
      if (user.status !== 'Active') {
        const auditReason = user.status === 'Suspended' ? 'suspended_account' : 
                            user.status === 'Inactive' ? 'inactive_account' : 'disabled_account';

        await logAuditAction('LOGIN_FAILED', 'employees', user.id, null, { 
          reason: auditReason, 
          email: cleanEmail 
        }, { id: user.id, role: user.role });

        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Verify correct role category
      if (user.role !== 'employee' && user.role !== 'hr') {
        await logAuditAction('LOGIN_FAILED', 'employees', user.id, null, { 
          reason: 'invalid_role', 
          email: cleanEmail 
        }, { id: user.id, role: user.role });

        await recordFailedAttempt(ipKey, accountKey, fromOfficeNetwork);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Handle MFA
      if (user.mfa_enabled) {
        const tempToken = await createToken({
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          mfa_pending: true,
          mfa_attempts: 0
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

      // Clear rate limit key on success
      await loginRateLimiter.delete(ipKey);
      await loginRateLimiter.delete(accountKey);

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
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (err) {
    console.error('Unified Login error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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

