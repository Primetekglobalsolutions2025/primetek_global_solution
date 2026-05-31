import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkIn, checkOut, requestWFH, startBreak, endBreak, resumeSession } from '@/app/employee/attendance/actions';
import { createTestEmployee, cleanupTestData, getTestSession } from '../setup';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { OFFICE_LOCATION } from '@/lib/location';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie } = nextHeaders as any;

describe('Attendance Integration Tests — Actions & Event Sourcing', () => {
  let employee: any;

  beforeEach(async () => {
    employee = await createTestEmployee();
    // Delete any global WFH overrides that interfere with attendance status and geofencing
    await supabaseAdmin.from('wfh_requests').delete().is('employee_id', null);
  });

  afterEach(async () => {
    await cleanupTestData(employee.id);
  });

  it('TEST-I1: checkIn() successful check-in within geofence', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Call check-in with office coordinates
    const res = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    console.log('TEST DEBUG checkIn result:', res);
    expect(res.success).toBe(true);
    expect(res.recordId).toBeDefined();

    // Query database directly to verify record was inserted
    const { data: record } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', res.recordId)
      .single();

    expect(record).not.toBeNull();
    expect(record.employee_id).toBe(employee.id);
    expect(record.status).toBe('Working');

    // Verify CLOCK_IN event exists in attendance_events
    const { data: events } = await supabaseAdmin
      .from('attendance_events')
      .select('*')
      .eq('session_id', res.recordId);

    expect(events).not.toBeNull();
    expect(events!.length).toBe(1);
    expect(events![0].event_type).toBe('CLOCK_IN');
  });

  it('TEST-I2: checkIn() rejection outside geofence', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Coords 2km away from Hyderabad office
    const res = await checkIn(17.365, 78.4667);
    expect(res.success).toBe(false);
    expect(res.outOfRadius).toBe(true);

    // Verify no record exists in attendance
    const { data: records } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', employee.id);

    expect(records).not.toBeNull();
    expect(records!.length).toBe(0);
  });

  it('TEST-I3: checkIn() duplicate prevention', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    const first = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(first.success).toBe(true);

    const second = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(second.success).toBe(false);
    expect(second.error).toContain('Already clocked in');
  });

  it('TEST-I4: checkIn() lateness calculation before & after grace period', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    // Mock Date.now to represent an on-time checkin (e.g. 6:35 PM IST = 13:05 UTC)
    const onTimeMockDate = new Date();
    onTimeMockDate.setUTCHours(13, 5, 0); // 13:05 UTC
    vi.useFakeTimers();
    vi.setSystemTime(onTimeMockDate);

    const resOnTime = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(resOnTime.success).toBe(true);

    const { data: recordOnTime } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', resOnTime.recordId)
      .single();
    expect(recordOnTime).not.toBeNull();
    expect(recordOnTime!.is_late).toBe(false);

    // Clean up first test record
    await cleanupTestData(employee.id);
    employee = await createTestEmployee();

    // Mock Date.now to represent a late checkin (e.g. 7:00 PM IST = 13:30 UTC)
    const lateMockDate = new Date();
    lateMockDate.setUTCHours(13, 30, 0); // 13:30 UTC
    vi.setSystemTime(lateMockDate);

    // Re-authenticate due to new employee object created
    const newSessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', newSessionToken);

    const resLate = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(resLate.success).toBe(true);

    const { data: recordLate } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', resLate.recordId)
      .single();
    expect(recordLate).not.toBeNull();
    expect(recordLate!.is_late).toBe(true);
    expect(recordLate!.late_minutes).toBe(30);

    vi.useRealTimers();
  });

  it('TEST-I5: checkOut() IDOR protection', async () => {
    const sessionTokenA = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);

    const checkinRes = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinRes.success).toBe(true);

    // Create employee B
    const employeeB = await createTestEmployee();
    try {
      const sessionTokenB = await getTestSession(employeeB.id, 'employee', employeeB.email);
      __mockSetCookie('employee-auth-token', sessionTokenB);

      // Employee B tries to check out Employee A's session
      const res = await checkOut(checkinRes.recordId!, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Attendance check-in record not found');
    } finally {
      await cleanupTestData(employeeB.id);
    }
  });

  it('TEST-I6: checkOut() successful checkout', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    const checkinRes = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinRes.success).toBe(true);

    const checkoutRes = await checkOut(checkinRes.recordId!, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkoutRes.success).toBe(true);

    const { data: record } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', checkinRes.recordId)
      .single();

    expect(record.check_out).not.toBeNull();
    expect(record.status).toBe('Logged Out');
  });

  it('TEST-I7: startBreak() and endBreak() flow', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    const checkinRes = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinRes.success).toBe(true);

    const brkStartRes = await startBreak();
    expect(brkStartRes.success).toBe(true);

    let { data: record } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', checkinRes.recordId)
      .single();
    expect(record.status).toBe('Break');

    const brkEndRes = await endBreak();
    expect(brkEndRes.success).toBe(true);

    record = (await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', checkinRes.recordId)
      .single()).data;
    expect(record.status).toBe('Working');
  });

  it('TEST-I8: resumeSession() 15-minute window', async () => {
    const sessionToken = await getTestSession(employee.id, 'employee', employee.email);
    __mockSetCookie('employee-auth-token', sessionToken);

    const checkinRes = await checkIn(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    expect(checkinRes.success).toBe(true);

    await checkOut(checkinRes.recordId!, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);

    const resumeRes = await resumeSession(checkinRes.recordId!);
    expect(resumeRes.success).toBe(true);

    const { data: record } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', checkinRes.recordId)
      .single();
    expect(record.check_out).toBeNull();
    expect(record.status).toBe('Working');
  });
});
