'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import type { ApplicationRecord } from './ApplicationsClient';
import { fullApplicationSchema } from '@/lib/validations';

export async function getAdminApplications() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

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
  await verifyActiveAdmin(session.id);

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
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

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
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

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
   

export async function createFullApplication(formData: unknown) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  // API-04: Parse and validate input data using Zod
  const parsed = fullApplicationSchema.safeParse(formData);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Validation failed: ${issues}`);
  }
  const validated = parsed.data;

  // 1. Create Application and Profile atomically via RPC
  const { data, error } = await supabaseAdmin.rpc('create_full_application', {
    p_job_id: validated.job_id,
    p_name: validated.name,
    p_email: validated.email,
    p_phone: validated.phone || null,
    p_experience_years: validated.experience_years ? Number(validated.experience_years) : null,
    p_assigned_to: validated.assigned_to || null,
    p_client_address: validated.client_address || null,
    p_client_role: validated.client_role || null,
    p_client_linkedin: validated.client_linkedin || null,
    p_role_category: validated.role_category,
    p_education_details: {
      bachelors: validated.education_bachelors || '',
      masters: validated.education_masters || '',
    }
  });

  if (error || (data && !data.success)) {
    console.error('Error creating application via RPC:', error || data?.error);
    throw new Error('Failed to create application');
  }

    // Fetch job title and notify other admins
    try {
      const { data: job } = await supabaseAdmin
        .from('jobs')
        .select('title')
        .eq('id', validated.job_id)
        .single();
      const jobTitle = job?.title || 'a position';

      const { data: admins } = await supabaseAdmin.from('admin_users').select('id');
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          // Skip notifying the current admin creator to avoid redundancy
          if (admin.id === session.id) continue;

          await dispatchNotification({
            title: `New Candidate Application`,
            message: `A new application has been submitted by ${validated.name} for the role of ${jobTitle}.`,
            type: 'new_applications',
            adminId: admin.id,
            clickActionUrl: '/admin/applications'
          });
        }
      }
    } catch (pushErr: any) {
      console.warn(`[Push Delivery Failed] action: createFullApplication, error: ${pushErr.message}`);
    }

  revalidatePath('/admin/applications');
  revalidatePath('/admin/client-profiles');
  return { success: true };
}


export async function assignApplication(applicationId: string, employeeId: string | null) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

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
