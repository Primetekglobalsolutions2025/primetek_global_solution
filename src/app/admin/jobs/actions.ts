'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { jobSchema } from '@/lib/validations';

export async function getAdminJobs() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

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
}

export async function saveJob(data: Record<string, unknown>, id?: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // API-05: Zod Validation on saveJob
  const parsed = jobSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Validation failed: ${issues}`);
  }
  const validated = parsed.data;

  if (id) {
    const { error } = await supabaseAdmin.from('jobs').update(validated).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from('jobs').insert([validated]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/jobs');
}

