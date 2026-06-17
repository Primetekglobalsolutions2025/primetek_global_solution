'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

export async function getAdminJobs() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin jobs:', error);
    return [];
  }
  return data;
}

export async function toggleJobActive(id: string, currentStatus: boolean) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { error } = await supabaseAdmin
    .from('jobs')
    .update({ is_active: !currentStatus })
    .eq('id', id);

  if (error) {
    console.error('Error toggling job:', error);
    throw new Error('Failed to toggle job');
  }

  revalidatePath('/admin/jobs');
  revalidatePath('/admin/jobs');
}

export async function saveJob(data: Record<string, unknown>, id?: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  if (id) {
    const { error } = await supabaseAdmin.from('jobs').update(data).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from('jobs').insert([data]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/jobs');
  revalidatePath('/admin/jobs');
}
