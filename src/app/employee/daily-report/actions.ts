'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getAssignedProfilesWithMetrics() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  // Fetch only active/processing profiles assigned to this employee
  const { data: profiles, error: pError } = await supabaseAdmin
    .from('application_profiles')
    .select('id, client_name, created_at, status')
    .eq('assigned_to', session.id)
    .in('status', ['assigned', 'processing', 'Assigned', 'Processing', 'pending', 'Pending'])
    .order('created_at', { ascending: false });

  if (pError) throw pError;

  // Normalize statuses to lowercase for frontend mapping consistency
  const normalizedProfiles = (profiles || []).map(p => ({
    ...p,
    status: p.status ? p.status.toLowerCase() : 'assigned'
  }));

  // Use local-like YYYY-MM-DD string
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const { data: todayMetrics, error: mError } = await supabaseAdmin
    .from('profile_daily_metrics')
    .select('*')
    .eq('employee_id', session.id)
    .eq('report_date', todayStr);

  if (mError) throw mError;

  return { 
    profiles: normalizedProfiles, 
    todayMetrics: todayMetrics || [], 
    reportDate: todayStr 
  };
}

import { z } from 'zod';

const metricEntrySchema = z.object({
  profile_id: z.string().uuid(),
  applications_count: z.number().int().min(0).max(100),
  interviews_count: z.number().int().min(0).max(100),
  assessments: z.number().int().min(0).max(100),
  technical_rounds: z.number().int().min(0).max(100),
  non_technical: z.number().int().min(0).max(100),
  self_submissions: z.number().int().min(0).max(100),
  support_submissions: z.number().int().min(0).max(100),
});

export async function submitDailyMetrics(entries: Array<{
  profile_id: string;
  applications_count: number;
  interviews_count: number;
  assessments: number;
  technical_rounds: number;
  non_technical: number;
  self_submissions: number;
  support_submissions: number;
}>) {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  // Verify that all profiles belong to the logged-in employee
  const { data: userProfiles, error: pError } = await supabaseAdmin
    .from('application_profiles')
    .select('id')
    .eq('assigned_to', session.id);

  if (pError || !userProfiles) {
    throw new Error('Failed to verify profile ownership');
  }

  const userProfileIds = new Set(userProfiles.map(p => p.id));

  // Validate each entry
  for (const entry of entries) {
    const parsed = metricEntrySchema.safeParse(entry);
    if (!parsed.success) {
      throw new Error(`Validation failed for profile metrics: ${parsed.error.message}`);
    }
    if (!userProfileIds.has(entry.profile_id)) {
      throw new Error(`Access denied: Profile is not assigned to you.`);
    }
  }

  const todayStr = new Date().toLocaleDateString('en-CA');

  const records = entries.map(entry => ({
    employee_id: session.id,
    profile_id: entry.profile_id,
    report_date: todayStr,
    applications_count: entry.applications_count,
    interviews_count: entry.interviews_count,
    assessments: entry.assessments,
    technical_rounds: entry.technical_rounds,
    non_technical: entry.non_technical,
    self_submissions: entry.self_submissions,
    support_submissions: entry.support_submissions,
  }));

  if (records.length === 0) return { success: true };

  const { error } = await supabaseAdmin
    .from('profile_daily_metrics')
    .upsert(records, { onConflict: 'profile_id,report_date' });

  if (error) {
    console.error('Submit Metrics Error:', error);
    throw error;
  }

  revalidatePath('/employee/daily-report');
  revalidatePath('/employee/dashboard');
  return { success: true };
}


export async function getMetricsHistory(days: number = 7) {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('profile_daily_metrics')
    .select(`
      id,
      profile_id,
      report_date,
      applications_count,
      interviews_count,
      assessments,
      technical_rounds,
      non_technical,
      self_submissions,
      support_submissions,
      created_at,
      application_profiles (
        client_name
      )
    `)
    .eq('employee_id', session.id)
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(days * 20); // Safety limit

  if (error) throw error;
  return data || [];
}
