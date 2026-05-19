import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validations';
import { createToken } from '@/lib/auth';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';
import { loginRateLimiter, CAPTCHA_THRESHOLD } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || (request as any).ip || '127.0.0.1';
  
  try {
    // 1. Check if IP is currently blocked
    const rateLimitRes = await loginRateLimiter.get(ip);
    if (rateLimitRes && rateLimitRes.remainingPoints <= 0) {
      return NextResponse.json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.',
        lockout: true 
      }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const cleanEmail = email.trim().toLowerCase();

    // 2. Auth Logic (Admin & Employee)
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('id, email')
      .ilike('email', cleanEmail)
      .single();

    const ADMIN_EMAIL_ENV = (process.env.ADMIN_EMAIL || 'admin@globalprimetek.com').trim().toLowerCase();
    
    let isAuthenticated = false;
    let authUser = null;

    if (adminRecord || cleanEmail === ADMIN_EMAIL_ENV) {
      const { data: authData, error: apiAuthError } = await supabaseAdmin.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (!apiAuthError && authData?.user) {
        isAuthenticated = true;
        authUser = {
          id: authData.user.id,
          email: authData.user.email || cleanEmail,
          role: 'admin' as const,
          name: authData.user.user_metadata?.full_name || 'Administrator',
        };
        if (!adminRecord) {
          await supabaseAdmin.from('admin_users').upsert({ id: authData.user.id, email: cleanEmail });
        }
      }
    }

    if (!isAuthenticated) {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('id, email, password_hash, name, role, status')
        .ilike('email', cleanEmail)
        .single();

      const dummyHash = '$2a$10$abcdefghijklmnopqrstuv';
      const hashToCompare = employee ? employee.password_hash : dummyHash;
      const isValidPassword = await bcrypt.compare(password, hashToCompare);

      if (isValidPassword && employee && employee.status?.toLowerCase() === 'active') {
        isAuthenticated = true;
        authUser = {
          id: employee.id,
          email: employee.email,
          role: employee.role,
          name: employee.name,
        };
      }
    }

    // 3. Handle Result
    if (isAuthenticated && authUser) {
      // SUCCESS: Clear rate limit for this IP
      await loginRateLimiter.delete(ip);

      // Check if MFA is enabled
      const table = authUser.role === 'admin' ? 'admin_users' : 'employees';
      const { data: userMFA } = await supabaseAdmin
        .from(table)
        .select('mfa_enabled')
        .eq('id', authUser.id)
        .single();

      if (userMFA?.mfa_enabled) {
        // Return MFA required status
        const tempToken = await createToken({ ...authUser, mfa_pending: true });
        const response = NextResponse.json({
          success: true,
          requiresMFA: true,
          user: { id: authUser.id, name: authUser.name, role: authUser.role },
        });

        response.cookies.set('mfa-pending-token', tempToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 5 * 60, // 5 minutes
          path: '/',
        });

        const elapsed = Date.now() - startTime;
        if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
        return response;
      }

      const token = await createToken(authUser);
      const response = NextResponse.json({
        success: true,
        user: { id: authUser.id, name: authUser.name, role: authUser.role },
      });

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 500) await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
      return response;
    }

    // FAILURE: Consume rate limit point
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
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Invalid credentials. Please try again.' }, { status: 401 });
  }
}
