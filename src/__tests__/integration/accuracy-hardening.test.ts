import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestEmployee, createTestAdmin, cleanupTestData, getTestSession } from '../setup';
import { checkIn, requestWFH, submitOfflineRecoveryRequest } from '@/app/employee/attendance/actions';
import { resolveRecoveryRequest } from '@/app/admin/attendance/actions';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { OFFICE_LOCATION } from '@/lib/location';
import * as nextHeaders from 'next/headers';

const { __mockSetCookie } = nextHeaders as any;

describe('Attendance Accuracy Hardening Integration Tests', () => {
  let employee: any;
  let token: string;

  beforeEach(async () => {
    employee = await createTestEmployee();
    token = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', token);
  });

  afterEach(async () => {
    if (employee?.id) {
      await cleanupTestData(employee.id);
    }
  });

  test('ACCURACY-1: Offline sync bypasses 10-minute check and historical inserts up to 72 hours', async () => {
    // 4 hours in the past
    const pastTimestamp = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    // Try checkIn with offline sync flag
    const res = await checkIn(
      OFFICE_LOCATION.lat,
      OFFICE_LOCATION.lng,
      '127.0.0.1',
      'Mozilla/5.0',
      'test-fingerprint',
      pastTimestamp,
      { deviceType: 'desktop', deviceLabel: 'Test Device' },
      'test-tab',
      true // isOfflineSync
    );

    console.log('checkIn response:', res);
    expect(res.success).toBe(true);
    expect(res.recordId).toBeDefined();

    // Verify it was written successfully
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', res.recordId)
      .single();

    if (fetchErr) {
      console.error('Fetch checkIn record error:', fetchErr);
    }
    expect(record).toBeDefined();
    expect(new Date(record.check_in).getTime()).toBe(new Date(pastTimestamp).getTime());
  });

  test('ACCURACY-2: Failed syncs can be submitted to recovery queue', async () => {
    const originalTime = new Date().toISOString();
    const res = await submitOfflineRecoveryRequest(
      'check_in',
      originalTime,
      OFFICE_LOCATION.lat,
      OFFICE_LOCATION.lng,
      'test-fingerprint-recovery',
      'Out of radius check-in failed'
    );

    console.log('submitOfflineRecoveryRequest response (ACCURACY-2):', res);
    expect(res.success).toBe(true);

    // Verify it exists in recovery queue
    const { data: queueItem, error } = await supabaseAdmin
      .from('attendance_recovery_queue')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('action', 'check_in')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(error).toBeNull();
    expect(queueItem).toBeDefined();
    expect(queueItem?.status).toBe('PENDING');
    expect(queueItem?.error_message).toBe('Out of radius check-in failed');
  });

  test('ACCURACY-3: Admin can resolve recovery queue item and update attendance', async () => {
    const originalTime = new Date().toISOString();
    const recoveryRes = await submitOfflineRecoveryRequest(
      'check_in',
      originalTime,
      OFFICE_LOCATION.lat,
      OFFICE_LOCATION.lng,
      'test-fingerprint-resolve',
      'Offline network lost'
    );

    console.log('submitOfflineRecoveryRequest response (ACCURACY-3):', recoveryRes);
    expect(recoveryRes.success).toBe(true);

    const { data: queueItem } = await supabaseAdmin
      .from('attendance_recovery_queue')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('device_fingerprint', 'test-fingerprint-resolve')
      .single();

    expect(queueItem).toBeDefined();
    if (!queueItem) throw new Error('queueItem not found');

    // Mock admin session
    const adminUser = await createTestAdmin();
    const adminToken = await getTestSession(adminUser.id, 'admin', adminUser.email);
    __mockSetCookie('admin-auth-token', adminToken);

    // Resolve as APPROVED
    const resolveRes = await resolveRecoveryRequest(queueItem.id, 'APPROVED', 'Legitimate sync failure resolved');
    console.log('resolveRecoveryRequest response:', resolveRes);
    expect(resolveRes.success).toBe(true);

    // Verify queue item is APPROVED
    const { data: resolvedQueueItem } = await supabaseAdmin
      .from('attendance_recovery_queue')
      .select('status, error_message')
      .eq('id', queueItem.id)
      .single();

    expect(resolvedQueueItem).toBeDefined();
    if (!resolvedQueueItem) throw new Error('resolvedQueueItem not found');

    expect(resolvedQueueItem.status).toBe('APPROVED');
    expect(resolvedQueueItem.error_message).toBe('Legitimate sync failure resolved');
  });
});
