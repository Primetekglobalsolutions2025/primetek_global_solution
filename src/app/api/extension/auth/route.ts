import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken } from '@/lib/auth';
import { createActiveSession } from '@/lib/security/session-tracker';
import bcrypt from 'bcryptjs';
import { logAuditAction } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown-ip';
    const userAgent = request.headers.get('user-agent') || 'chrome-extension';

    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { email, password, fingerprint } = body;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Look up employee by email or employee_id
    const isEmail = cleanEmail.includes('@');
    const query = supabaseAdmin
      .from('employees')
      .select('id, email, employee_id, password_hash, status, name, role');
      
    const { data: user, error: dbErr } = await (isEmail 
      ? query.ilike('email', cleanEmail).maybeSingle() 
      : query.ilike('employee_id', cleanEmail).maybeSingle());

    if (dbErr || !user) {
      // Dummy bcrypt operation to prevent timing attacks
      await bcrypt.compare(cleanPassword, '$2a$12$L8n8GvU.Y2d7b4OdfGkY3.2SDFs67asdfaHsklj123HjkasdfHj12');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(cleanPassword, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify account status
    if (user.status !== 'Active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 401 });
    }

    // Create active session in database for tracking
    const sessionRecord = await createActiveSession({
      userId: user.id,
      role: user.role,
      ipAddress: ip,
      userAgent,
      deviceFingerprint: fingerprint || 'chrome-extension',
    });

    if (!sessionRecord) {
      return NextResponse.json({ error: 'Failed to initialize session' }, { status: 500 });
    }

    // Generate JWT token
    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    await logAuditAction('EXTENSION_LOGIN_SUCCESS', 'employees', user.id, null, null, { id: user.id, role: user.role });

    return NextResponse.json({
      success: true,
      token,
      employee: {
        id: user.id,
        employee_id: user.employee_id,
        name: user.name,
        email: user.email,
      }
    });
  } catch (err) {
    console.error('Extension Auth error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
