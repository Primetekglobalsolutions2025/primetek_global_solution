'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';

export async function getAllInterviewRequests() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('interview_requests')
    .select(`
      *,
      employee:employees(name),
      profile:application_profiles(resume_url)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch interview requests:', error);
    throw new Error('Database fetch failed');
  }
  return data;
}

export async function updateInterviewStatus(requestId: string, status: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { error: 'Unauthorized' };

    // Fetch old status for audit
    const { data: oldData, error: fetchError } = await supabaseAdmin
      .from('interview_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !oldData) {
      return { error: 'Interview request not found' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('interview_requests')
      .update({ status })
      .eq('id', requestId);

    if (updateError) {
      console.error('Failed to update request status:', updateError);
      return { error: 'Failed to update request status' };
    }

    // Log audit action
    await logAuditAction('UPDATE_INTERVIEW_STATUS', 'interview_requests', requestId, oldData, { status });

    revalidatePath('/admin/interview-requests');
    return { success: true };
  } catch (err: any) {
    console.error('updateInterviewStatus crashed:', err);
    return { error: err.message || 'Internal server error' };
  }
}
