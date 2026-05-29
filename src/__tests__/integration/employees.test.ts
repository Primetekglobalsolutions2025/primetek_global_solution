import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmployee, deleteEmployee, toggleEmployeeStatus } from '@/app/admin/employees/actions';
import { createTestEmployee, cleanupTestData, getTestSession, createTestAdmin } from '../setup';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie } = nextHeaders as any;

describe('Employee Registry Integration Tests — createEmployee & deleteEmployee', () => {
  let admin: any;
  let employeeIdToCleanup: string | null = null;

  beforeEach(async () => {
    admin = await createTestAdmin();
    employeeIdToCleanup = null;
  });

  afterEach(async () => {
    if (employeeIdToCleanup) {
      await cleanupTestData(employeeIdToCleanup);
    }
  });

  it('TEST-I21: createEmployee() full flow & validation', async () => {
    // Authenticate as Admin
    const adminSession = await getTestSession(admin.id, 'admin', admin.email);
    __mockSetCookie('admin-auth-token', adminSession);

    const email = `new_hire_${Math.floor(Math.random() * 100000)}@primetek.com`;
    const res = await createEmployee({
      name: 'New Hire',
      email,
      role: 'employee',
      department: 'Engineering',
    });

    expect(res.success).toBe(true);
    expect(res.employee_id).toMatch(/^cmk\d{7}$/);
    expect(res.password).toBeDefined();
    expect(res.password?.length).toBeGreaterThan(12);

    // Fetch new employee record to cleanup later
    const { data: empRecord } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('employee_id', res.employee_id)
      .single();

    expect(empRecord).not.toBeNull();
    employeeIdToCleanup = empRecord.id;

    // Assert leave balance record was created for current month
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const { data: balance } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', empRecord.id)
      .eq('leave_type', 'Casual')
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .single();

    expect(balance).not.toBeNull();
    expect(balance.total_days).toBe(1);

    // Verify the returned password works by hashing check
    const match = await bcrypt.compare(res.password!, empRecord.password_hash);
    expect(match).toBe(true);
  });

  it('TEST-I22: deleteEmployee() cascade cleanup', async () => {
    // Authenticate as Admin
    const adminSession = await getTestSession(admin.id, 'admin', admin.email);
    __mockSetCookie('admin-auth-token', adminSession);

    // Create a temporary test employee to delete
    const tempEmp = await createTestEmployee();
    const empId = tempEmp.id;

    // Simulate active session, trusted device and risk event for this employee
    await supabaseAdmin.from('active_sessions').insert({
      user_id: empId,
      is_valid: true,
      ip_address: '127.0.0.1',
      user_agent: 'Vitest Test',
    });

    await supabaseAdmin.from('trusted_devices').insert({
      user_id: empId,
      device_fingerprint: 'test-fingerprint',
      device_label: 'Vitest Device',
    });

    await supabaseAdmin.from('attendance_risk_events').insert({
      employee_id: empId,
      action: 'check_in',
      risk_level: 'low',
      risk_score: 5,
      risk_reasons: [],
      ip_address: '127.0.0.1',
    });

    // Delete the employee
    const deleteRes = await deleteEmployee(empId);
    expect(deleteRes.success).toBe(true);

    // Assert employee record is gone
    const { data: empRecord } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', empId)
      .maybeSingle();
    expect(empRecord).toBeNull();

    // Assert active_sessions are cascade-deleted
    const { data: sessionRecords } = await supabaseAdmin
      .from('active_sessions')
      .select('*')
      .eq('user_id', empId);
    expect(sessionRecords!.length).toBe(0);

    // Assert trusted_devices are cascade-deleted
    const { data: deviceRecords } = await supabaseAdmin
      .from('trusted_devices')
      .select('*')
      .eq('user_id', empId);
    expect(deviceRecords!.length).toBe(0);

    // Assert risk events are deleted
    const { data: riskRecords } = await supabaseAdmin
      .from('attendance_risk_events')
      .select('*')
      .eq('employee_id', empId);
    expect(riskRecords!.length).toBe(0);
  });
});
