import { config } from 'dotenv';
import path from 'path';

// Load test environment variables before any other imports
config({ path: path.resolve(process.cwd(), '.env.test') });

import { vi, afterEach, beforeAll } from 'vitest';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createToken } from '@/lib/auth';
import { OFFICE_LOCATION } from '@/lib/location';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Global Next.js Mocks
vi.mock('next/headers', () => {
  const store = new Map();
  return {
    headers: vi.fn(async () => {
      const headersMap = new Map();
      headersMap.set('x-forwarded-for', '127.0.0.1');
      headersMap.set('user-agent', 'Vitest Agent');
      headersMap.set('x-correlation-id', 'test-correlation-id');
      return headersMap;
    }),
    cookies: vi.fn(async () => {
      return {
        get: vi.fn((name: string) => {
          const val = store.get(name);
          return val ? { name, value: val } : undefined;
        }),
        set: vi.fn((name: string, value: string) => {
          store.set(name, value);
        }),
        delete: vi.fn((name: string) => {
          store.delete(name);
        }),
      };
    }),
    // Helper to inject mock cookies in tests
    __mockSetCookie: (name: string, value: string) => {
      store.set(name, value);
    },
    __mockClearCookies: () => {
      store.clear();
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: any) => fn),
}));

vi.mock('@/lib/cache/office-location', () => ({
  getCachedActiveOfficeLocation: vi.fn(async () => ({
    name: 'Primetek HQ, Hyderabad',
    lat: 17.44569123225756,
    lng: 78.38649648531063,
    radius_meters: 500,
  })),
}));

// Reset vi mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  try {
    const { __mockClearCookies } = require('next/headers') as any;
    if (__mockClearCookies) __mockClearCookies();
  } catch {}
});

// Office locations DB mutating logic removed to protect user data from tests.
// The active office location cache helper is now mocked above in setup.ts.

/**
 * Creates a real employee in the test database.
 */
export async function createTestEmployee() {
  const rand = crypto.randomBytes(4).toString('hex');
  const employeeId = `cmk${Math.floor(1000000 + Math.random() * 9000000)}`;
  const email = `test_emp_${rand}@example.com`;
  const password = 'TestPass123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const { data: employee, error } = await supabaseAdmin
    .from('employees')
    .insert({
      employee_id: employeeId,
      name: `Test Employee ${rand}`,
      email,
      password_hash: passwordHash,
      role: 'employee',
      status: 'Active',
      join_date: new Date().toISOString().split('T')[0],
    })
    .select('*')
    .single();

  if (error || !employee) {
    throw new Error(`Failed to create test employee: ${error?.message || 'unknown error'}`);
  }

  // Create default leave balance — only Casual type is allowed by DB constraint.
  // The DB uses monthly granularity with unique constraint (employee_id, leave_type, year, month).
  // Seed balance for June 2026 (month=6) to match the leave test dates (2026-06-09).
  // Also seed balance for the current month so leave queries work for the current period.
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const balancesToInsert: any[] = [
    {
      employee_id: employee.id,
      leave_type: 'Casual',
      total_days: 1,
      used_days: 0,
      year: 2026,
      month: 6, // June 2026 — matches test leave request dates
    },
  ];

  // Also add current month if it's not June 2026
  if (currentYear !== 2026 || currentMonth !== 6) {
    balancesToInsert.push({
      employee_id: employee.id,
      leave_type: 'Casual',
      total_days: 1,
      used_days: 0,
      year: currentYear,
      month: currentMonth,
    });
  }

  await supabaseAdmin.from('leave_balances').insert(balancesToInsert);

  // Ensure active session exists in DB
  await supabaseAdmin.from('active_sessions').delete().eq('user_id', employee.id);
  const { error: sessionError } = await supabaseAdmin.from('active_sessions').insert({
    user_id: employee.id,
    user_role: 'employee',
    is_valid: true,
    ip_address: '127.0.0.1',
    user_agent: 'Vitest Agent',
  });
  if (sessionError) {
    throw new Error(`Failed to create active session: ${sessionError.message}`);
  }

  return {
    ...employee,
    password,
  };
}

export async function createTestAdmin() {
  const email = 'test_admin@primetek.com';
  let userId: string;

  // Provision Admin in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'TestPass123!',
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already') || authError.message.includes('registered')) {
      const { data: existingAdmin } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (!existingAdmin) throw new Error(`User claimed to exist but not found in public.admin_users: ${email}`);
      userId = existingAdmin.id;
    } else {
      throw new Error(`Failed to create test admin auth user: ${authError.message}`);
    }
  } else {
    userId = authData.user.id;
  }

  // Ensure active session exists in DB
  await supabaseAdmin.from('active_sessions').delete().eq('user_id', userId);
  const { error: sessionError } = await supabaseAdmin.from('active_sessions').insert({
    user_id: userId,
    user_role: 'admin',
    is_valid: true,
    ip_address: '127.0.0.1',
    user_agent: 'Vitest Agent',
  });
  if (sessionError) {
    throw new Error(`Failed to create admin active session: ${sessionError.message}`);
  }

  // Ensure public.admin_users record exists
  const { data: existing } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: admin, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      id: userId,
      email,
      role: 'SUPER_ADMIN',
    })
    .select('*')
    .single();

  if (error || !admin) {
    throw new Error(`Failed to create test admin profile record: ${error?.message || 'unknown error'}`);
  }

  return admin;
}

/**
 * Generates a real JWT token for a given employee or admin.
 */
export async function getTestSession(userId: string, role: string = 'employee', email: string = 'test@example.com') {
  return createToken({ id: userId, email, role });
}

/**
 * Helper to clean up all database tables for a specific employee ID.
 */
export async function cleanupTestData(employeeId: string) {
  if (!employeeId) return;

  // Run deletes in dependency order (foreign keys first)
  // Tables that use employee_id as the FK column
  const employeeFkTables = [
    'disputes',
    'attendance_events',
    'attendance_risk_events',
    'attendance_projections',
    'attendance',
    'leave_requests',
    'leave_balances',
    'trusted_devices',
    'wfh_requests',
  ];

  for (const table of employeeFkTables) {
    try {
      await supabaseAdmin.from(table).delete().eq('employee_id', employeeId);
    } catch (err) {
      console.warn(`Cleanup failed for table ${table}:`, err);
    }
  }

  // active_sessions uses user_id, not employee_id
  try {
    await supabaseAdmin.from('active_sessions').delete().eq('user_id', employeeId);
  } catch (err) {
    console.warn('Cleanup failed for active_sessions:', err);
  }

  // Finally delete the employee record itself
  try {
    await supabaseAdmin.from('employees').delete().eq('id', employeeId);
  } catch (err) {
    console.warn('Failed to delete employee during cleanup:', err);
  }
}
