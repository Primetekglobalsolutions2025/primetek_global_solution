import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { submitWFHRequest, getEmployeeWFHRequests } from '@/app/employee/wfh/actions';
import { updateWFHRequestStatus, createWFHOverride } from '@/app/admin/wfh/actions';
import { checkIn } from '@/app/employee/attendance/actions';
import { createTestEmployee, cleanupTestData, getTestSession, createTestAdmin } from '../setup';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getISTShiftDate } from '@/lib/utils';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie, __mockClearCookies } = nextHeaders as any;

describe('WFH Requests & Overrides Integration Tests', () => {
  let employee: any;
  let admin: any;

  beforeEach(async () => {
    employee = await createTestEmployee();
    admin = await createTestAdmin();
  });

  afterEach(async () => {
    await cleanupTestData(employee.id);
    // Cleanup wfh_requests created during tests
    await supabaseAdmin.from('wfh_requests').delete().eq('employee_id', employee.id);
    await supabaseAdmin.from('wfh_requests').delete().is('employee_id', null);
    if (__mockClearCookies) __mockClearCookies();
  });

  it('TEST-W1: Employee submits a WFH request and admin approves it', async () => {
    const empSession = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', empSession);

    // 1. Submit request
    const res = await submitWFHRequest({
      start_date: '2026-07-06', // Monday
      end_date: '2026-07-08',   // Wednesday
      reason: 'Home maintenance',
    });

    expect(res.success).toBe(true);
    expect(res.request).toBeDefined();
    expect(res.request.status).toBe('Pending');

    // 2. Fetch requests as employee
    const empRequests = await getEmployeeWFHRequests();
    expect(empRequests.length).toBeGreaterThan(0);
    const pendingReq = empRequests.find(r => r.id === res.request.id);
    expect(pendingReq).toBeDefined();
    expect(pendingReq!.status).toBe('Pending');

    // 3. Admin approves
    const adminSession = await getTestSession(admin.id, 'admin', admin.email);
    __mockSetCookie('admin-auth-token', adminSession);

    const approveRes = await updateWFHRequestStatus(res.request.id, 'Approved');
    expect(approveRes.success).toBe(true);

    // 4. Verify in DB
    const { data: dbRequest } = await supabaseAdmin
      .from('wfh_requests')
      .select('status')
      .eq('id', res.request.id)
      .single();

    expect(dbRequest).not.toBeNull();
    expect(dbRequest!.status).toBe('Approved');
  });

  it('TEST-W2: Global WFH override bypasses geofencing and sets status automatically', async () => {
    // 1. Create a global override as admin for today
    const adminSession = await getTestSession(admin.id, 'admin', admin.email);
    __mockSetCookie('admin-auth-token', adminSession);

    const todayStr = getISTShiftDate();
    const overrideRes = await createWFHOverride({
      employee_id: null, // null = Global override
      start_date: todayStr,
      end_date: todayStr,
      reason: 'Office power outage emergency',
    });

    expect(overrideRes.success).toBe(true);

    // 2. Check-in as employee from way outside office radius (lat: 20.0, lng: 80.0)
    __mockClearCookies();
    const empSession = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', empSession);

    const checkInRes = await checkIn(
      20.0, // lat
      80.0, // lng
      '127.0.0.1',
      'Mozilla/5.0',
      'test-fingerprint',
      new Date().toISOString(), // clientTimestamp
      { deviceType: 'desktop', deviceLabel: 'Test Chrome' }
    );

    console.log('CHECKIN_RESPONSE_LOG:', checkInRes);
    expect(checkInRes.success).toBe(true);
    expect(checkInRes.isWFHActive).toBe(true);

    // 3. Verify attendance record status and audit log payload
    const { data: attendance } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', checkInRes.recordId)
      .single();

    expect(attendance).not.toBeNull();
    expect(attendance!.status).toBe('Approved WFH');

    // Verify CLOCK_IN event payload contains is_pre_approved_wfh: true
    const { data: event } = await supabaseAdmin
      .from('attendance_events')
      .select('*')
      .eq('session_id', checkInRes.recordId)
      .eq('event_type', 'CLOCK_IN')
      .single();

    expect(event).not.toBeNull();
    expect(event!.payload?.is_pre_approved_wfh).toBe(true);
  });
});
