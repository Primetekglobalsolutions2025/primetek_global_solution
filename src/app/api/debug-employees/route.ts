import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json({ 
        error: 'Missing credentials in process.env',
        url: url || null,
        keyExists: !!key
      }, { status: 500 });
    }

    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // If ?test_email and ?test_password are provided, test the login flow
    const testEmail = request.nextUrl.searchParams.get('test_email');
    const testPassword = request.nextUrl.searchParams.get('test_password');

    if (testEmail && testPassword) {
      const cleanEmail = testEmail.trim().toLowerCase();
      const isEmail = cleanEmail.includes('@');

      const query = client
        .from('employees')
        .select('id, email, employee_id, password_hash, status, role, name');

      const { data: employee, error } = await (isEmail
        ? query.ilike('email', cleanEmail).single()
        : query.ilike('employee_id', cleanEmail).single());

      if (error) {
        return NextResponse.json({ 
          step: 'db_query',
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          isEmail,
          cleanEmail
        });
      }

      if (!employee) {
        return NextResponse.json({ 
          step: 'not_found',
          message: 'No employee found with this email/ID',
          isEmail,
          cleanEmail
        });
      }

      const hashExists = !!employee.password_hash;
      const hashLength = employee.password_hash?.length || 0;
      const hashPrefix = employee.password_hash?.substring(0, 10) || 'null';
      
      let bcryptResult = false;
      let bcryptError = null;
      try {
        bcryptResult = await bcrypt.compare(testPassword, employee.password_hash || '');
      } catch (e: any) {
        bcryptError = e.message;
      }

      return NextResponse.json({
        step: 'login_test',
        found: true,
        employee: {
          id: employee.id,
          email: employee.email,
          employee_id: employee.employee_id,
          status: employee.status,
          role: employee.role,
          name: employee.name,
        },
        passwordCheck: {
          hashExists,
          hashLength,
          hashPrefix,
          bcryptResult,
          bcryptError,
          testPasswordLength: testPassword.length,
        }
      });
    }

    // Default: list all employees (no password hashes for safety)
    const { data: employees, error } = await client
      .from('employees')
      .select('id, name, email, employee_id, status, role')
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: employees?.length, employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
