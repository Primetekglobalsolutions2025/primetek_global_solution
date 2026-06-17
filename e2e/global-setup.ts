import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

async function globalSetup() {
  // Load environment variables from .env.test
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials in .env.test for global setup');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('Running Playwright Global Setup against:', supabaseUrl);

  // Clear rate limits for E2E testing to prevent CAPTCHAs from triggering
  const { error: clearRateLimitsError } = await supabase
    .from('rate_limits')
    .delete()
    .neq('key', '');
  if (clearRateLimitsError) {
    console.warn('Warning: Failed to clear rate limits in global setup:', clearRateLimitsError.message);
  } else {
    console.log('Cleared all rate limits in the test database.');
  }

  // 1. Setup Admin: admin@primetekglobalsolutions.com
  const adminEmail = 'admin@primetekglobalsolutions.com';
  const adminPassword = 'AdminPass123!';
  let adminId: string;

  const { data: existingAdmin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', adminEmail)
    .maybeSingle();

  if (existingAdmin) {
    adminId = existingAdmin.id;
    // Reset password to ensure it matches
    const { error: updateError } = await supabase.auth.admin.updateUserById(adminId, {
      password: adminPassword,
    });
    if (updateError) throw updateError;
    console.log('Admin user password updated in Supabase Auth.');
  } else {
    const { data: newAuthAdmin, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (createError) {
      if (createError.message.includes('already') || createError.message.includes('registered')) {
        // In case auth user exists but public profile doesn't, let's try to query auth metadata if possible or fail gracefully
        throw new Error(`Admin auth user exists but public profile is missing for email: ${adminEmail}. Please run SQL cleanup.`);
      }
      throw createError;
    }
    adminId = newAuthAdmin.user.id;
    console.log('Admin user created in Supabase Auth.');
  }

  // Ensure public.admin_users record exists
  const { data: existingAdminProfile } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', adminId)
    .maybeSingle();

  if (!existingAdminProfile) {
    const { error: profileError } = await supabase
      .from('admin_users')
      .insert({
        id: adminId,
        email: adminEmail,
        role: 'SUPER_ADMIN',
      });
    if (profileError) throw profileError;
    console.log('Admin user profile created in public.admin_users.');
  }

  // Ensure active session for admin
  await supabase.from('active_sessions').delete().eq('user_id', adminId);
  const { error: adminSessionError } = await supabase.from('active_sessions').insert({
    user_id: adminId,
    user_role: 'admin',
    is_valid: true,
    ip_address: '127.0.0.1',
    user_agent: 'Playwright E2E',
  });
  if (adminSessionError) throw adminSessionError;

  // 2. Setup Employee: cmk1234567
  const empIdStr = 'cmk1234567';
  const empEmail = 'e2e_employee@primetek.com';
  const empPassword = 'TestPass123!';
  const empPasswordHash = await bcrypt.hash(empPassword, 12);

  const { data: existingEmp } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_id', empIdStr)
    .maybeSingle();

  let employeeIdUuid: string;

  if (existingEmp) {
    employeeIdUuid = existingEmp.id;
    // Update email and password hash to ensure they match
    const { error: empUpdateError } = await supabase
      .from('employees')
      .update({
        email: empEmail,
        password_hash: empPasswordHash,
        status: 'Active',
      })
      .eq('id', employeeIdUuid);
    if (empUpdateError) throw empUpdateError;
    console.log('Employee updated in public.employees.');
  } else {
    const { data: newEmp, error: empCreateError } = await supabase
      .from('employees')
      .insert({
        employee_id: empIdStr,
        name: 'E2E Test Employee',
        email: empEmail,
        password_hash: empPasswordHash,
        role: 'employee',
        status: 'Active',
        join_date: '2026-01-01',
      })
      .select('id')
      .single();
    if (empCreateError) throw empCreateError;
    employeeIdUuid = newEmp.id;
    console.log('Employee created in public.employees.');
  }

  // Clear any existing attendance, leaves, and event logs for this employee to ensure a clean clocked-out slate
  await supabase.from('leave_requests').delete().eq('employee_id', employeeIdUuid);
  await supabase.from('attendance_events').delete().eq('employee_id', employeeIdUuid);
  await supabase.from('attendance_risk_events').delete().eq('employee_id', employeeIdUuid);
  await supabase.from('attendance').delete().eq('employee_id', employeeIdUuid);
  console.log('Cleared all attendance and leave requests logs for the test employee.');

  // Ensure leave balances exist for employee for June 2026
  const { data: existingBalance } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeIdUuid)
    .eq('leave_type', 'Casual')
    .eq('year', 2026)
    .eq('month', 6)
    .maybeSingle();

  if (!existingBalance) {
    const { error: balanceError } = await supabase
      .from('leave_balances')
      .insert({
        employee_id: employeeIdUuid,
        leave_type: 'Casual',
        total_days: 5,
        used_days: 0,
        year: 2026,
        month: 6,
      });
    if (balanceError) throw balanceError;
    console.log('Leave balance for Casual June 2026 created.');
  } else {
    // Reset balance so tests don't fail due to insufficient days
    const { error: balanceUpdateError } = await supabase
      .from('leave_balances')
      .update({
        total_days: 5,
        used_days: 0,
      })
      .eq('id', existingBalance.id);
    if (balanceUpdateError) throw balanceUpdateError;
    console.log('Leave balance reset for Casual June 2026.');
  }

  // Ensure active session for employee
  await supabase.from('active_sessions').delete().eq('user_id', employeeIdUuid);
  const { error: empSessionError } = await supabase.from('active_sessions').insert({
    user_id: employeeIdUuid,
    user_role: 'employee',
    is_valid: true,
    ip_address: '127.0.0.1',
    user_agent: 'Playwright E2E',
  });
  if (empSessionError) throw empSessionError;

  // Ensure office location is seeded
  const { data: officeLoc } = await supabase
    .from('office_locations')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!officeLoc) {
    const { error: locError } = await supabase
      .from('office_locations')
      .insert({
        name: 'Hyderabad Headquarters',
        lat: 17.4483,
        lng: 78.3741,
        radius_meters: 500,
        is_active: true,
      });
    if (locError) throw locError;
    console.log('Office location seeded.');
  }

  console.log('Playwright Global Setup completed successfully.');
}

export default globalSetup;
