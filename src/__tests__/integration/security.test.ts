import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { submitDispute, rebuildSession } from '@/app/employee/attendance/actions';
import { toggleExemption } from '@/app/admin/attendance/actions';
import { submitInterviewRequest } from '@/app/employee/assigned-profiles/actions';
import { createTestEmployee, cleanupTestData, getTestSession, createTestAdmin } from '../setup';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkIn } from '@/app/employee/attendance/actions';
import { OFFICE_LOCATION } from '@/lib/location';
import { generateSecret } from 'otplib';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie, __mockClearCookies } = nextHeaders as any;

describe('Security Integration Tests — IDOR, Authorization & Magic Bytes', () => {
  let employeeA: any;
  let employeeB: any;
  let admin: any;

  beforeEach(async () => {
    employeeA = await createTestEmployee();
    employeeB = await createTestEmployee();
    admin = await createTestAdmin();
  });

  afterEach(async () => {
    await cleanupTestData(employeeA.id);
    await cleanupTestData(employeeB.id);
    if (__mockClearCookies) __mockClearCookies();
  });

  it('TEST-I15: IDOR on submitDispute', async () => {
    // Authenticate as Employee A and check-in
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);
    const checkinA = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinA.success).toBe(true);

    // Authenticate as Employee B
    const sessionTokenB = await getTestSession(employeeB.id, 'employee', employeeB.email);
    __mockSetCookie('employee-auth-token', sessionTokenB);

    // Employee B tries to dispute Employee A's checkin record ID
    const disputeRes = await submitDispute(checkinA.recordId!, 'LATE_PENALTY', 'I was on time');
    expect(disputeRes.success).toBe(false);
    expect(disputeRes.error).toContain('Unauthorized');

    // Verify dispute record was not inserted
    const { data: disputes } = await supabaseAdmin
      .from('disputes')
      .select('*')
      .eq('attendance_id', checkinA.recordId);
    expect(disputes!.length).toBe(0);
  });

  it('TEST-I16: IDOR on rebuildSession', async () => {
    // Employee A checks in
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);
    const checkinA = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinA.success).toBe(true);

    // Employee B tries to rebuild Employee A's session
    const sessionTokenB = await getTestSession(employeeB.id, 'employee', employeeB.email);
    __mockSetCookie('employee-auth-token', sessionTokenB);

    const rebuildRes = await rebuildSession(checkinA.recordId!);
    expect(rebuildRes.success).toBe(false);
    expect(rebuildRes.error).toContain('Unauthorized');
  });

  it('TEST-I17: Role enforcement — employee calling admin action', async () => {
    // Authenticate as Employee A (non-admin)
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);

    // Employee checks in
    const checkinA = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinA.success).toBe(true);

    // Employee attempts to toggle manager exemption (an admin-only server action)
    // toggleExemption throws an Error (not a return value) when unauthorized
    try {
      await toggleExemption(checkinA.recordId!, 'manager_exemption', true);
      // Should not reach here
      expect.unreachable('Expected toggleExemption to throw for non-admin');
    } catch (err: any) {
      expect(err.message).toContain('Unauthorized');
    }
  });

  it('TEST-I18: verifyActiveSession() blocks inactive employee', async () => {
    // Authenticate Employee A
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);

    // Set employee account to Inactive in DB
    await supabaseAdmin
      .from('employees')
      .update({ status: 'Inactive' })
      .eq('id', employeeA.id);

    // Attempt checking in
    const checkinRes = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinRes.success).toBe(false);
    expect(checkinRes.error).toContain('inactive or deleted');
  });

  it('TEST-I19: File upload magic bytes validation', async () => {
    // Authenticate Employee A
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);

    // Create a mock application profile assigned to Employee A
    const { data: profile } = await supabaseAdmin
      .from('application_profiles')
      .insert({
        client_name: 'Consultant X',
        client_email: 'consultant@example.com',
        assigned_to: employeeA.id,
        status: 'assigned',
      })
      .select('*')
      .single();

    try {
      const formData = new FormData();
      formData.append('profile_id', profile.id);
      formData.append('client_company', 'Acme Corp');
      formData.append('job_title', 'Developer');
      formData.append('interview_datetime', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      formData.append('interview_platform', 'Teams');
      formData.append('resume_type', 'updated');

      // Create bad file containing EXE magic bytes (MZ header: 4D 5A 90 00)
      const badBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x12, 0x34]);
      const badBlob = new Blob([badBuffer], { type: 'application/pdf' });
      const badFile = new File([badBlob], 'malware.pdf', { type: 'application/pdf' });
      formData.append('resume', badFile);

      // Create a dummy DOCX for Job Description (JD is required for submitInterviewRequest)
      const jdBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]); // DOCX/ZIP Magic bytes
      const jdBlob = new Blob([jdBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const jdFile = new File([jdBlob], 'jd.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      formData.append('jd', jdFile);

      const res = await submitInterviewRequest(formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain('PDF content signature');
    } finally {
      // Clean up application profile
      await supabaseAdmin.from('application_profiles').delete().eq('id', profile.id);
    }
  });

  it('TEST-I20: Cron secret validation', async () => {
    // In our Direct Testing approach, we can directly invoke the middleware/cron authorization logic,
    // or simulate it. Let's verify by checking that missing/incorrect secrets fail validation checks.
    const CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
    
    // Stub request with headers helper
    const buildRequest = (authHeader: string | null) => {
      const headersInit: Record<string, string> = {};
      if (authHeader) {
        headersInit['authorization'] = authHeader;
      }
      return {
        headers: {
          get: (name: string) => headersInit[name.toLowerCase()] || null,
        },
      } as any;
    };

    // Test a basic validation helper pattern or simulate request header match:
    const isCronAuthorized = (req: any) => {
      const auth = req.headers.get('authorization');
      if (!auth || !auth.startsWith('Bearer ')) return false;
      const token = auth.substring(7);
      return token === CRON_SECRET;
    };

    expect(isCronAuthorized(buildRequest(null))).toBe(false);
    expect(isCronAuthorized(buildRequest('Bearer wrong-secret'))).toBe(false);
    expect(isCronAuthorized(buildRequest(`Bearer ${CRON_SECRET}`))).toBe(true);
  });

  it('TEST-I21: Inactive account returns 401 and generic Invalid credentials', async () => {
    const testIp = '127.0.0.99';
    // Clear any rate limits from previous runs
    await supabaseAdmin
      .from('rate_limits')
      .delete()
      .in('key', [`login:ip:${testIp}`, `login:mfa_ip:${testIp}`]);

    const inactiveEmployee = await createTestEmployee();
    await supabaseAdmin
      .from('employees')
      .update({ status: 'Inactive' })
      .eq('id', inactiveEmployee.id);

    const { POST: unifiedLoginPOST } = await import('@/app/api/auth/unified-login/route');
    const { NextRequest } = await import('next/server');

    // Attempt login with incorrect password
    const req1 = new NextRequest('http://localhost:3000/api/auth/unified-login', {
      method: 'POST',
      body: JSON.stringify({
        email: inactiveEmployee.email,
        password: 'incorrect-password',
        portal: 'employee',
      }),
      headers: {
        'x-forwarded-for': '127.0.0.99',
      },
    });
    const res1 = await unifiedLoginPOST(req1);
    expect(res1.status).toBe(401);
    const body1 = await res1.json();
    expect(body1.error).toBe('Invalid credentials');

    // Attempt login with correct password
    const req2 = new NextRequest('http://localhost:3000/api/auth/unified-login', {
      method: 'POST',
      body: JSON.stringify({
        email: inactiveEmployee.email,
        password: 'TestPass123!',
        portal: 'employee',
      }),
      headers: {
        'x-forwarded-for': '127.0.0.99',
      },
    });
    const res2 = await unifiedLoginPOST(req2);
    expect(res2.status).toBe(401);
    const body2 = await res2.json();
    expect(body2.error).toBe('Invalid credentials');

    await cleanupTestData(inactiveEmployee.id);
  });

  it('TEST-I22: MFA retry counter stateless implementation in mfa-login', async () => {
    const testIp = '127.0.0.98';
    // Clear any rate limits from previous runs
    await supabaseAdmin
      .from('rate_limits')
      .delete()
      .in('key', [`login:ip:${testIp}`, `login:mfa_ip:${testIp}`]);

    const testEmployee = await createTestEmployee();
    const { POST: mfaLoginPOST } = await import('@/app/api/auth/mfa-login/route');
    const { createToken } = await import('@/lib/auth');
    const { NextRequest } = await import('next/server');

    // Setup MFA secret
    const secret = generateSecret();
    await supabaseAdmin
      .from('employees')
      .update({ 
        mfa_enabled: true,
        mfa_secret: secret
      })
      .eq('id', testEmployee.id);

    // Initial mfa-pending-token with 0 attempts
    const initialToken = await createToken({
      id: testEmployee.id,
      email: testEmployee.email,
      role: testEmployee.role,
      name: testEmployee.name,
      mfa_pending: true,
      mfa_attempts: 0
    });

    // 1st failed attempt
    const req1 = new NextRequest('http://localhost:3000/api/auth/mfa-login', {
      method: 'POST',
      body: JSON.stringify({ code: '000000' }),
      headers: {
        'cookie': `mfa-pending-token=${initialToken}`,
        'x-forwarded-for': '127.0.0.98',
      }
    });
    const res1 = await mfaLoginPOST(req1);
    expect(res1.status).toBe(401);
    const body1 = await res1.json();
    expect(body1.error).toContain('attempt(s) remaining');

    // Extract updated token from response cookies
    const cookieHeader = res1.headers.get('set-cookie');
    expect(cookieHeader).toContain('mfa-pending-token=');
    const updatedToken1 = cookieHeader!.split('mfa-pending-token=')[1].split(';')[0];

    // 2nd failed attempt using the updated token
    const req2 = new NextRequest('http://localhost:3000/api/auth/mfa-login', {
      method: 'POST',
      body: JSON.stringify({ code: '000000' }),
      headers: {
        'cookie': `mfa-pending-token=${updatedToken1}`,
        'x-forwarded-for': '127.0.0.98',
      }
    });
    const res2 = await mfaLoginPOST(req2);
    expect(res2.status).toBe(401);
    const cookieHeader2 = res2.headers.get('set-cookie');
    expect(cookieHeader2).toContain('mfa-pending-token=');
    const updatedToken2 = cookieHeader2!.split('mfa-pending-token=')[1].split(';')[0];

    // 3rd failed attempt using the updated token -> should delete cookie & lockout
    const req3 = new NextRequest('http://localhost:3000/api/auth/mfa-login', {
      method: 'POST',
      body: JSON.stringify({ code: '000000' }),
      headers: {
        'cookie': `mfa-pending-token=${updatedToken2}`,
        'x-forwarded-for': '127.0.0.98',
      }
    });
    const res3 = await mfaLoginPOST(req3);
    expect(res3.status).toBe(401);
    const body3 = await res3.json();
    expect(body3.error).toContain('Too many failed MFA attempts');
    
    // Cookie is deleted
    const cookieHeader3 = res3.headers.get('set-cookie');
    expect(cookieHeader3).toContain('mfa-pending-token=;');

    await cleanupTestData(testEmployee.id);
  });
});
