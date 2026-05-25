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
    .in('status', ['assigned', 'processing'])
    .order('created_at', { ascending: false });

  if (pError) throw pError;

  // Use local-like YYYY-MM-DD string
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const { data: todayMetrics, error: mError } = await supabaseAdmin
    .from('profile_daily_metrics')
    .select('*')
    .eq('employee_id', session.id)
    .eq('report_date', todayStr);

  if (mError) throw mError;

  return { 
    profiles: profiles || [], 
    todayMetrics: todayMetrics || [], 
    reportDate: todayStr 
  };
}

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
