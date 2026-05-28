'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import type { ApplicationRecord } from './ApplicationsClient';
import { fullApplicationSchema } from '@/lib/validations';

export async function getAdminApplications() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('applications')
    .select(`
      *,
      jobs (
        title
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('Error fetching admin applications:', error);
    return [];
  }


  // Format data to match client expectations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((app: Record<string, any>) => ({
    ...app,
    job_title: app.jobs?.title || 'Unknown Job',
  })) as ApplicationRecord[];
}

export async function updateApplicationStatus(id: string, status: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // API-02: Validate status parameter
  const VALID_STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected'];
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid application status value');
  }

  const { error } = await supabaseAdmin
    .from('applications')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating application status:', error);
    throw new Error('Failed to update status');
  }

  revalidatePath('/admin/applications');
}

// CODE-01/API-03: updateApplicationNotes stub deleted as it is unused dead code.

export async function getAllEmployees() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, department, role')
    .eq('role', 'employee')
    .eq('status', 'Active')
    .order('name');

  if (error) {
    console.error('Error fetching employees for assignment:', error);
    return [];
  }
  return data;
}

export async function getActiveJobs() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('id, title')
    .eq('is_active', true)
    .order('title');

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
  return data;
}
   

export async function createFullApplication(formData: any) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // API-04: Parse and validate input data using Zod
  const parsed = fullApplicationSchema.safeParse(formData);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Validation failed: ${issues}`);
  }
  const validated = parsed.data;

  // 1. Create Application
  const { data: app, error: appError } = await supabaseAdmin
    .from('applications')
    .insert({
      job_id: validated.job_id,
      name: validated.name,
      email: validated.email,
      phone: validated.phone || null,
      experience_years: validated.experience_years ? Number(validated.experience_years) : null,
      status: 'pending',
      assigned_to: validated.assigned_to || null,
    })
    .select()
    .single();

  if (appError) {
    console.error('Error creating application:', appError);
    throw new Error('Failed to create application');
  }

  // 2. Create Profile
  const { error: profileError } = await supabaseAdmin
    .from('application_profiles')
    .insert({
      application_id: app.id,
      assigned_to: validated.assigned_to || null,
      client_name: validated.name,
      client_email: validated.email,
      client_phone: validated.phone || null,
      client_address: validated.client_address || null,
      client_role: validated.client_role || null,
      client_linkedin: validated.client_linkedin || null,
      role_category: validated.role_category,
      education_details: {
        bachelors: validated.education_bachelors || '',
        masters: validated.education_masters || '',
      },
      status: validated.assigned_to ? 'assigned' : 'processing',
    });

  if (profileError) {
    console.error('Error creating application profile:', profileError);
    // CODE-02: Rollback the created application to avoid orphaned record / inconsistent state
    await supabaseAdmin.from('applications').delete().eq('id', app.id);
    throw new Error('Failed to create application profile. Action rolled back.');
  }

  revalidatePath('/admin/applications');
  revalidatePath('/admin/client-profiles');
  return { success: true };
}


export async function assignApplication(applicationId: string, employeeId: string | null) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { error } = await supabaseAdmin
    .from('applications')
    .update({ assigned_to: employeeId })
    .eq('id', applicationId);

  if (error) {
    console.error('Error assigning application:', error);
    throw new Error('Failed to assign application');
  }

  // Also update profile assignment if it exists
  await supabaseAdmin
    .from('application_profiles')
    .update({ 
      assigned_to: employeeId,
      status: employeeId ? 'assigned' : 'processing'
    })
    .eq('application_id', applicationId);

  revalidatePath('/admin/applications');
  revalidatePath('/admin/client-profiles');
  return { success: true };
}
