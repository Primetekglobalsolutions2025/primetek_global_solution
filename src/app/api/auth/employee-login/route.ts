import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { loginRateLimiter, CAPTCHA_THRESHOLD } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || (request as any).ip || '127.0.0.1';

  try {
    const rateLimitRes = await loginRateLimiter.get(ip);
    if (rateLimitRes && rateLimitRes.remainingPoints <= 0) {
      return NextResponse.json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.',
        lockout: true 
      }, { status: 429 });
    }

    const { email, password } = await request.json(); // 'email' field might actually contain employee_id

    const isEmail = email.includes('@');
    const query = supabaseAdmin
      .from('employees')
      .select('id, email, password_hash, status, name, role');
      
    const { data: employee } = await (isEmail 
      ? query.eq('email', email).single() 
      : query.eq('employee_id', email).single());

    const dummyHash = '$2a$10$abcdefghijklmnopqrstuv'; // For constant time
    const hashToCompare = employee ? employee.password_hash : dummyHash;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (isValidPassword && employee && employee.status === 'Active') {
      // SUCCESS: Clear rate limit
      await loginRateLimiter.delete(ip);

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

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));

      return response;
    }

    // FAILURE: Consume point
    const currentRes = await loginRateLimiter.consume(ip).catch(err => err);
    const failedAttempts = 5 - (currentRes.remainingPoints || 0);

    const responseData: any = { error: 'Invalid credentials. Please try again.' };
    if (failedAttempts >= CAPTCHA_THRESHOLD) {
      responseData.showCaptcha = true;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
    return NextResponse.json(responseData, { status: 401 });
  } catch (err) {
    console.error('Login error:', err);
    const elapsed = Date.now() - startTime;
    if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
    return NextResponse.json({ error: 'Invalid credentials. Please try again.' }, { status: 401 });
  }
}
