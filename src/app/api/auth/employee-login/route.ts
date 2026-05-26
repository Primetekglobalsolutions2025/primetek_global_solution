import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { loginRateLimiter, CAPTCHA_THRESHOLD } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || (request as any).ip || '127.0.0.1';

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { email, password } = body;
    const cleanEmail = email.trim().toLowerCase();
    const rateLimitKey = `${ip}_${cleanEmail}`;

    const rateLimitRes = await loginRateLimiter.get(rateLimitKey);
    if (rateLimitRes && rateLimitRes.remainingPoints <= 0) {
      return NextResponse.json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.',
        lockout: true 
      }, { status: 429 });
    }

    const isEmail = cleanEmail.includes('@');
    const { data: employee } = await (isEmail 
      ? supabaseAdmin
          .from('employees')
          .select('id, email, password_hash, status, name, role')
          .ilike('email', cleanEmail)
          .single()
      : supabaseAdmin
          .from('employees')
          .select('id, email, password_hash, status, name, role')
          .ilike('employee_id', cleanEmail)
          .single());

    const dummyHash = '$2a$10$abcdefghijklmnopqrstuv'; // For constant time
    const hashToCompare = employee ? employee.password_hash : dummyHash;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (isValidPassword && employee && employee.status === 'Active') {
      // SUCCESS: Clear rate limit
      await loginRateLimiter.delete(rateLimitKey);

      const authUser = {
        id: employee.id,
        email: employee.email,
        role: employee.role || 'employee',
        name: employee.name,
      };

      // Check if MFA is enabled
      const { data: userMFA } = await supabaseAdmin
        .from('employees')
        .select('mfa_enabled')
        .eq('id', employee.id)
        .single();

      if (userMFA?.mfa_enabled) {
        const tempToken = await createToken({ ...authUser, mfa_pending: true });
        const response = NextResponse.json({ success: true, requiresMFA: true });

        response.cookies.set('mfa-pending-token', tempToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 5 * 60,
          path: '/',
        });

        const elapsed = Date.now() - startTime;
        if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
        return response;
      }

      const token = await createToken(authUser);
      const response = NextResponse.json({ success: true, name: employee.name });

      response.cookies.set('employee-auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));

      return response;
    }

    // FAILURE: Consume point for this user on this IP
    const currentRes = await loginRateLimiter.consume(rateLimitKey).catch(err => err);
    const failedAttempts = 5 - (currentRes.remainingPoints || 0);

    const responseData: any = { error: 'Invalid credentials. Please try again.' };
    if (failedAttempts >= CAPTCHA_THRESHOLD) {
      responseData.showCaptcha = true;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
    return NextResponse.json(responseData, { status: 401 });
  } catch (err) {
    console.error('Login error:', err instanceof Error ? err.message : String(err));
    const elapsed = Date.now() - startTime;
    if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
    return NextResponse.json({ error: 'Invalid credentials. Please try again.' }, { status: 401 });
  }
}
