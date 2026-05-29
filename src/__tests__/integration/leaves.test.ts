import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyForLeave } from '@/app/employee/leaves/actions';
import { updateLeaveStatus } from '@/app/admin/approvals/actions';
import { createTestEmployee, cleanupTestData, getTestSession, createTestAdmin } from '../setup';
import { supabaseAdmin } from '@/lib/supabase-admin';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie, __mockClearCookies } = nextHeaders as any;

describe('Leaves Integration Tests — applyForLeave & updateLeaveStatus', () => {
  let employee: any;
  let admin: any;

  beforeEach(async () => {
    employee = await createTestEmployee();
    admin = await createTestAdmin();
  });

  afterEach(async () => {
    await cleanupTestData(employee.id);
    if (__mockClearCookies) __mockClearCookies();
  });

  it('TEST-I9: applyForLeave() successful casual leave', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Apply for leave on a Tuesday (valid weekday)
    const res = await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-09', // June 9, 2026 is Tuesday
      end_date: '2026-06-09',
      reason: 'Doctor appointment',
    });

    expect(res.success).toBe(true);

    // Verify record exists in DB
    const { data: requests } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employee.id);

    expect(requests).not.toBeNull();
    expect(requests!.length).toBe(1);
    expect(requests![0].status).toBe('Pending');
    expect(requests![0].type).toBe('Casual');
  });

  it('TEST-I10: applyForLeave() weekend rejection', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Apply for leave on a Saturday (June 6, 2026 is Saturday)
    const res = await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-06',
      end_date: '2026-06-06',
      reason: 'Weekend trip',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('cannot fall on weekends');
  });

  it('TEST-I11: applyForLeave() overlap rejection', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Create first request
    const res1 = await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-09', // Tuesday
      end_date: '2026-06-09',
      reason: 'Dentist appointment',
    });
    expect(res1.success).toBe(true);

    // Try creating overlapping request
    const res2 = await applyForLeave({
      type: 'Unpaid',
      start_date: '2026-06-09',
      end_date: '2026-06-09',
      reason: 'Duplicate request',
    });

    expect(res2.success).toBe(false);
    expect(res2.error).toContain('overlapping leave request');
  });

  it('TEST-I12: applyForLeave() monthly CL limit (max 1 CL per calendar month)', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Apply for first Casual Leave in June
    const res1 = await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-09', // Tuesday
      end_date: '2026-06-09',
      reason: 'First casual leave',
    });
    expect(res1.success).toBe(true);

    // Try applying for a second Casual Leave in June (different week but same month)
    const res2 = await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-16', // Tuesday
      end_date: '2026-06-16',
      reason: 'Second casual leave',
    });

    expect(res2.success).toBe(false);
    expect(res2.error).toContain('already requested or taken Casual Leave in this calendar month');
  });

  it('TEST-I13: updateLeaveStatus() approval with balance deduction', async () => {
    const empSession = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', empSession);

    // Apply for leave
    await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-09', // Tuesday
      end_date: '2026-06-09',
      reason: 'Personal work',
    });

    const { data: request } = await supabaseAdmin
      .from('leave_requests')
      .select('id')
      .eq('employee_id', employee.id)
      .single();

    expect(request).not.toBeNull();

    // Authenticate as Admin
    const adminSession = await getTestSession(admin.id, 'admin', admin.email);
    __mockSetCookie('admin-auth-token', adminSession);

    // Approve the leave
    const approveRes = await updateLeaveStatus(request!.id, 'Approved');
    expect(approveRes.success).toBe(true);

    // Verify leave status in DB
    const { data: approvedRequest } = await supabaseAdmin
      .from('leave_requests')
      .select('status')
      .eq('id', request!.id)
      .single();
    expect(approvedRequest).not.toBeNull();
    expect(approvedRequest!.status).toBe('Approved');

    // Verify balance deduction in DB
    const { data: balances } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('leave_type', 'Casual');

    expect(balances).not.toBeNull();
    // Casual leave balance is 1 CL per calendar month. After 1 approval, used=1, remaining=0.
    const defaultBalance = balances!.find((b: any) => b.year === 2026 && b.month === 6);
    expect(defaultBalance).toBeDefined();
    expect(defaultBalance.used_days).toBe(1);
    expect(defaultBalance.remaining_days).toBe(0);
  });

  it('TEST-I14: updateLeaveStatus() idempotency checks', async () => {
    const empSession = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', empSession);

    await applyForLeave({
      type: 'Casual',
      start_date: '2026-06-09',
      end_date: '2026-06-09',
      reason: 'Vacation',
    });

    const { data: request } = await supabaseAdmin
      .from('leave_requests')
      .select('id')
      .eq('employee_id', employee.id)
      .single();

    expect(request).not.toBeNull();

    const adminSession = await getTestSession(admin.id, 'admin', admin.email);
    __mockSetCookie('admin-auth-token', adminSession);

    // First approval
    const firstRes = await updateLeaveStatus(request!.id, 'Approved');
    expect(firstRes.success).toBe(true);

    // Second approval (should be idempotent)
    const secondRes = await updateLeaveStatus(request!.id, 'Approved');
    expect(secondRes.success).toBe(true);
    expect(secondRes.message).toContain('already approved');

    // Verify balance was only deducted once
    const { data: balances } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('leave_type', 'Casual');

    expect(balances).not.toBeNull();
    const defaultBalance = balances!.find((b: any) => b.year === 2026 && b.month === 6);
    expect(defaultBalance).toBeDefined();
    expect(defaultBalance.used_days).toBe(1);
  });
});
