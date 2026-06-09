import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/auth/unified-login/route';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import * as attendanceActions from '@/app/employee/attendance/actions';
import * as approvalsPage from '@/app/admin/approvals/page';
import * as dashboardPage from '@/app/admin/dashboard/page';
import { createTestEmployee, cleanupTestData, getTestSession } from '../setup';
import { checkIn, submitDispute } from '@/app/employee/attendance/actions';
import { OFFICE_LOCATION } from '@/lib/location';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie, __mockClearCookies } = nextHeaders as any;

describe('Regression Tests for Remediated Vulnerabilities & Bugs', () => {
  let employeeA: any;
  let employeeB: any;

  beforeEach(async () => {
    employeeA = await createTestEmployee();
    employeeB = await createTestEmployee();

    // Clear rate limits to prevent test interference and captcha triggering
    await supabaseAdmin
      .from('rate_limits')
      .delete()
      .in('key', [
        'login:ip:127.0.0.1',
        'login:ip:unknown-ip',
        `login:account:${employeeA.email.toLowerCase()}`,
        `login:account:${employeeB.email.toLowerCase()}`,
        'login:account:admin-not-in-db@primetekglobalsolutions.com',
        'login:account:test_admin@primetek.com'
      ]);
  });

  afterEach(async () => {
    await cleanupTestData(employeeA.id);
    await cleanupTestData(employeeB.id);
    
    // Clean up rate limits after test execution
    await supabaseAdmin
      .from('rate_limits')
      .delete()
      .in('key', [
        'login:ip:127.0.0.1',
        'login:ip:unknown-ip',
        `login:account:${employeeA.email.toLowerCase()}`,
        `login:account:${employeeB.email.toLowerCase()}`,
        'login:account:admin-not-in-db@primetekglobalsolutions.com',
        'login:account:test_admin@primetek.com'
      ]);

    if (__mockClearCookies) __mockClearCookies();
  });

  it('REGRESSION-1: Admin auto-upsert removed (Security fix C-12)', async () => {
    // Regression for SECURITY_AUDIT_REPORT.md Critical #12
    const testAdminEmail = 'admin-not-in-db@primetekglobalsolutions.com';

    // Ensure the email does not exist in the admin_users table
    await supabaseAdmin.from('admin_users').delete().eq('email', testAdminEmail);

    const req = new NextRequest('http://localhost:3000/api/auth/unified-login', {
      method: 'POST',
      body: JSON.stringify({
        email: testAdminEmail,
        password: 'SomePassword123!',
      }),
    });

    const res = await POST(req);
    // Should return 401 or 403, and absolutely not 200
    expect([401, 403]).toContain(res.status);

    // Verify admin_users table was not modified or auto-created
    const { data: record } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', testAdminEmail)
      .maybeSingle();

    expect(record).toBeNull();
  });

  it('REGRESSION-2: closeStaleSessionsForEmployee not exported (Security fix C-2)', () => {
    // Regression for SECURITY_AUDIT_REPORT.md Critical #2
    // Assert that the internal sweeper helper closeStaleSessionsForEmployee is not exposed in module exports
    expect((attendanceActions as any).closeStaleSessionsForEmployee).toBeUndefined();
  });

  it('REGRESSION-3: force-dynamic on approvals page (Code quality fix C-6)', () => {
    // Regression for AUDIT_REPORT.md Critical #6
    expect(approvalsPage.dynamic).toBe('force-dynamic');
  });

  it('REGRESSION-4: force-dynamic on dashboard page (Code quality fix C-10)', () => {
    // Regression for AUDIT_REPORT.md Critical #10
    expect(dashboardPage.dynamic).toBe('force-dynamic');
  });

  it('REGRESSION-5: BOLA on submitDispute (Security fix C-6)', async () => {
    // Regression for SECURITY_AUDIT_REPORT.md Critical #6
    
    // Authenticate as Employee A and check-in
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);
    const checkinA = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinA.success).toBe(true);

    // Authenticate as Employee B
    const sessionTokenB = await getTestSession(employeeB.id, 'employee', employeeB.email);
    __mockSetCookie('employee-auth-token', sessionTokenB);

    // Employee B tries to submit dispute on Employee A's attendanceId
    const res = await submitDispute(checkinA.recordId!, 'LATE_PENALTY', 'Attempting IDOR / BOLA');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');

    // Verify no dispute was added to DB
    const { data: dispute } = await supabaseAdmin
      .from('disputes')
      .select('*')
      .eq('attendance_id', checkinA.recordId)
      .maybeSingle();
    expect(dispute).toBeNull();
  });

  it('REGRESSION-6: Lateness uses server clock not client timestamp (Security fix H-2)', async () => {
    // Regression for SECURITY_AUDIT_REPORT.md High #2
    const sessionToken = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Mock server time to 6:52 PM IST (13:22 UTC), which is late (threshold is 6:45 PM IST / 13:15 UTC)
    const lateServerTime = new Date();
    lateServerTime.setUTCHours(13, 22, 0);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(lateServerTime);

    // Call checkIn with clientTimestamp set to 6:44 PM IST (13:14 UTC) which is on-time
    // Difference is -8 minutes (within 10-minute allowed drift)
    const backdatedClientTime = new Date(lateServerTime);
    backdatedClientTime.setUTCHours(13, 14, 0);

    const res = await checkIn(
      OFFICE_LOCATION.lat,
      OFFICE_LOCATION.lng,
      '127.0.0.1',
      'Mozilla',
      'fingerprint',
      backdatedClientTime.toISOString() // backdated client timestamp
    );
    expect(res.success).toBe(true);

    // Verify database record indicates late because it uses server time
    const { data: record } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', res.recordId)
      .single();

    expect(record).not.toBeNull();
    expect(record!.is_late).toBe(true);
    expect(record!.late_minutes).toBe(22); // 6:52 PM - 6:30 PM shift start = 22 minutes late

    vi.useRealTimers();
  });

  it('REGRESSION-7: Admin login portal rejects employee credentials', async () => {
    // Attempt login with portal: 'admin' using an employee's credentials
    const req = new NextRequest('http://localhost:3000/api/auth/unified-login', {
      method: 'POST',
      body: JSON.stringify({
        email: employeeA.email,
        password: 'TestPass123!',
        portal: 'admin',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid credentials');
  });

  it('REGRESSION-8: Employee login portal rejects admin credentials', async () => {
    // Attempt login with portal: 'employee' using an admin's credentials
    const ADMIN_EMAIL_ENV = 'test_admin@primetek.com';
    const req = new NextRequest('http://localhost:3000/api/auth/unified-login', {
      method: 'POST',
      body: JSON.stringify({
        email: ADMIN_EMAIL_ENV,
        password: 'TestPass123!',
        portal: 'employee',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid credentials');
  });
});
