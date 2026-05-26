import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { loginRateLimiter, CAPTCHA_THRESHOLD } from '@/lib/rate-limit';

/**
 * Diagnostic endpoint that mirrors the exact employee-login flow
 * but returns step-by-step debug info instead of hiding errors.
 * TEMPORARY - remove after fixing login issue.
 */
export async function POST(request: NextRequest) {
  const steps: { step: string; result: string; detail?: any }[] = [];
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  try {
    // Step 1: Parse body
    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Email and password are required', steps });
    }
    steps.push({ step: 'parse_body', result: 'OK', detail: { emailLength: body.email.length, passwordLength: body.password.length } });

    const { email, password } = body;
    const cleanEmail = email.trim().toLowerCase();
    const rateLimitKey = `${ip}_${cleanEmail}`;

    // Step 2: Rate limit check
    try {
      const rateLimitRes = await loginRateLimiter.get(rateLimitKey);
      steps.push({ step: 'rate_limit', result: 'OK', detail: { 
        exists: !!rateLimitRes, 
        remainingPoints: rateLimitRes?.remainingPoints ?? 'N/A' 
      }});
      if (rateLimitRes && rateLimitRes.remainingPoints <= 0) {
        return NextResponse.json({ error: 'Rate limited', steps });
      }
    } catch (rlErr: any) {
      steps.push({ step: 'rate_limit', result: 'ERROR', detail: rlErr.message });
      // Don't return - continue to see if login works
    }

    // Step 3: Build query
    const isEmail = cleanEmail.includes('@');
    steps.push({ step: 'input_check', result: 'OK', detail: { cleanEmail, isEmail } });

    // Step 4: Execute Supabase query
    let employee: any = null;
    let queryError: any = null;
    try {
      const query = supabaseAdmin
        .from('employees')
        .select('id, email, password_hash, status, name, role');

      const { data, error } = await (isEmail
        ? query.ilike('email', cleanEmail).single()
        : query.ilike('employee_id', cleanEmail).single());

      employee = data;
      queryError = error;

      steps.push({ step: 'db_query', result: error ? 'ERROR' : 'OK', detail: {
        found: !!data,
        error: error ? { message: error.message, code: error.code, hint: error.hint } : null,
        employeeId: data?.id,
        employeeEmail: data?.email,
        status: data?.status,
        hashExists: !!data?.password_hash,
        hashLength: data?.password_hash?.length,
        hashPrefix: data?.password_hash?.substring(0, 7),
      }});
    } catch (dbErr: any) {
      steps.push({ step: 'db_query', result: 'EXCEPTION', detail: dbErr.message });
      return NextResponse.json({ error: 'DB query threw exception', steps });
    }

    // Step 5: bcrypt compare
    try {
      const dummyHash = '$2a$10$abcdefghijklmnopqrstuv';
      const hashToCompare = employee ? employee.password_hash : dummyHash;
      const isValidPassword = await bcrypt.compare(password, hashToCompare);

      steps.push({ step: 'bcrypt_compare', result: isValidPassword ? 'MATCH' : 'NO_MATCH', detail: {
        usedDummyHash: !employee,
        hashPrefix: hashToCompare?.substring(0, 7),
      }});

      // Step 6: Status check
      if (employee) {
        steps.push({ step: 'status_check', result: employee.status === 'Active' ? 'ACTIVE' : 'INACTIVE', detail: { status: employee.status } });
      }

      // Step 7: Final check
      const wouldSucceed = isValidPassword && employee && employee.status === 'Active';
      steps.push({ step: 'final_check', result: wouldSucceed ? 'WOULD_LOGIN' : 'WOULD_FAIL', detail: {
        isValidPassword,
        employeeExists: !!employee,
        statusActive: employee?.status === 'Active',
      }});

      if (wouldSucceed) {
        // Step 8: Token creation
        try {
          const authUser = {
            id: employee.id,
            email: employee.email,
            role: employee.role || 'employee',
            name: employee.name,
          };
          const token = await createToken(authUser);
          steps.push({ step: 'create_token', result: 'OK', detail: { tokenLength: token.length } });
        } catch (tokenErr: any) {
          steps.push({ step: 'create_token', result: 'ERROR', detail: tokenErr.message });
        }
      }

    } catch (bcryptErr: any) {
      steps.push({ step: 'bcrypt_compare', result: 'EXCEPTION', detail: bcryptErr.message });
    }

    return NextResponse.json({ steps, elapsed: Date.now() - startTime });
  } catch (err: any) {
    steps.push({ step: 'outer_catch', result: 'EXCEPTION', detail: err.message });
    return NextResponse.json({ error: 'Outer exception', steps, elapsed: Date.now() - startTime });
  }
}
