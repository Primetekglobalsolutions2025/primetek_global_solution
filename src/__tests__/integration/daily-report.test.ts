import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { submitDailyMetrics } from '@/app/employee/daily-report/actions';
import { createTestEmployee, cleanupTestData, getTestSession } from '../setup';
import { supabaseAdmin } from '@/lib/supabase-admin';

import * as nextHeaders from 'next/headers';
const { __mockSetCookie } = nextHeaders as any;

describe('Daily Report Integration Tests — submitDailyMetrics', () => {
  let employeeA: any;
  let employeeB: any;
  let profileA: any;

  beforeEach(async () => {
    employeeA = await createTestEmployee();
    employeeB = await createTestEmployee();

    // Create a mock application profile assigned to Employee A
    const { data: profile } = await supabaseAdmin
      .from('application_profiles')
      .insert({
        client_name: 'Consultant A',
        assigned_to: employeeA.id,
        status: 'assigned',
      })
      .select('*')
      .single();

    profileA = profile;
  });

  afterEach(async () => {
    // Delete profile and daily metrics first
    if (profileA?.id) {
      await supabaseAdmin.from('profile_daily_metrics').delete().eq('profile_id', profileA.id);
      await supabaseAdmin.from('application_profiles').delete().eq('id', profileA.id);
    }
    await cleanupTestData(employeeA.id);
    await cleanupTestData(employeeB.id);
  });

  it('TEST-I23: submitDailyMetrics() ownership checks', async () => {
    // Authenticate as Employee B (who does not own profileA)
    const sessionTokenB = await getTestSession(employeeB.id, 'employee', employeeB.email);
    __mockSetCookie('employee-auth-token', sessionTokenB);

    const metricsEntry = {
      profile_id: profileA.id,
      applications_count: 5,
      interviews_count: 1,
      assessments: 0,
      technical_rounds: 0,
      non_technical: 0,
      self_submissions: 2,
      support_submissions: 3,
    };

    // Employee B attempts to submit metrics for Employee A's profile
    const res = await submitDailyMetrics([metricsEntry]);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Access denied: Profile is not assigned to you.');

    // Verify record was not inserted
    const { data: metrics } = await supabaseAdmin
      .from('profile_daily_metrics')
      .select('*')
      .eq('profile_id', profileA.id);
    expect(metrics!.length).toBe(0);
  });

  it('TEST-I24: submitDailyMetrics() successful insertion and upsert behavior', async () => {
    // Authenticate as Employee A (who owns profileA)
    const sessionTokenA = await getTestSession(employeeA.id, 'employee', employeeA.email);
    __mockSetCookie('employee-auth-token', sessionTokenA);

    const metricsEntry1 = {
      profile_id: profileA.id,
      applications_count: 10,
      interviews_count: 2,
      assessments: 1,
      technical_rounds: 1,
      non_technical: 0,
      self_submissions: 5,
      support_submissions: 5,
    };

    // Insert first daily report
    const res1 = await submitDailyMetrics([metricsEntry1]);
    expect(res1.success).toBe(true);

    // Verify record is in database
    const { data: metrics1 } = await supabaseAdmin
      .from('profile_daily_metrics')
      .select('*')
      .eq('profile_id', profileA.id);
    expect(metrics1!.length).toBe(1);
    expect(metrics1![0].applications_count).toBe(10);

    // Submit metrics again for the same profile and same day (upsert conflict)
    const metricsEntry2 = {
      profile_id: profileA.id,
      applications_count: 15, // updated count
      interviews_count: 2,
      assessments: 1,
      technical_rounds: 1,
      non_technical: 0,
      self_submissions: 5,
      support_submissions: 5,
    };

    const res2 = await submitDailyMetrics([metricsEntry2]);
    expect(res2.success).toBe(true);

    // Verify record was updated in conflict, not duplicated
    const { data: metrics2 } = await supabaseAdmin
      .from('profile_daily_metrics')
      .select('*')
      .eq('profile_id', profileA.id);
    expect(metrics2!.length).toBe(1); // Still exactly 1 row
    expect(metrics2![0].applications_count).toBe(15); // Value updated
  });
});
