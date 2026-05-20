'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { sendNotificationEmail, getAssignmentTemplate } from '@/lib/notifications';

export async function getAllProfiles() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('application_profiles')
    .select(`
      *,
      assigned_employee:employees(id, name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createProfile(formData: any) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { error: 'Unauthorized' };

    const { error, data } = await supabaseAdmin
      .from('application_profiles')
      .insert([formData])
      .select()
      .single();

    if (error) {
      console.error('Create Profile Error:', error);
      return { error: error.message || 'Database error occurred' };
    }

    // Log the action
    await logAuditAction('CREATE_PROFILE', 'application_profiles', data.id, null, formData);

    // If assigned to an employee, send a notification
    if (formData.assigned_to) {
      const { data: employee } = await supabaseAdmin.from('employees').select('name, email').eq('id', formData.assigned_to).single();
      if (employee) {
        await sendNotificationEmail(
          employee.email, 
          'New Assignment: ' + formData.client_name, 
          getAssignmentTemplate(employee.name, formData.client_name)
        );
      }
    }
    
    revalidatePath('/admin/client-profiles');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Internal server error' };
  }
}

export async function updateProfile(id: string, formData: any) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { error: 'Unauthorized' };

    // Fetch old data for audit
    const { data: oldData } = await supabaseAdmin.from('application_profiles').select('*').eq('id', id).single();

    const { error } = await supabaseAdmin
      .from('application_profiles')
      .update(formData)
      .eq('id', id);

    if (error) {
      console.error('Update Profile Error:', error);
      return { error: error.message || 'Database error occurred' };
    }

    // Log the action
    await logAuditAction('UPDATE_PROFILE', 'application_profiles', id, oldData, formData);

    // If assignment changed, notify new employee
    if (formData.assigned_to && formData.assigned_to !== oldData?.assigned_to) {
      const { data: employee } = await supabaseAdmin.from('employees').select('name, email').eq('id', formData.assigned_to).single();
      if (employee) {
        await sendNotificationEmail(
          employee.email, 
          'New Assignment: ' + (formData.client_name || oldData.client_name), 
          getAssignmentTemplate(employee.name, formData.client_name || oldData.client_name)
        );
      }
    }

    revalidatePath('/admin/client-profiles');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Internal server error' };
  }
}

export async function deleteProfile(id: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // Fetch data for audit before deleting
  const { data: oldData } = await supabaseAdmin.from('application_profiles').select('*').eq('id', id).single();

  const { error } = await supabaseAdmin
    .from('application_profiles')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Log the action
  await logAuditAction('DELETE_PROFILE', 'application_profiles', id, oldData, null);

  revalidatePath('/admin/client-profiles');
  return { success: true };
}

export async function getAllEmployees() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name')
    .eq('status', 'Active');

  if (error) throw error;
  return data;
}

export async function uploadClientResume(formData: FormData) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { error: 'Unauthorized' };

    const file = formData.get('resume') as File | null;
    if (!file) return { error: 'No file provided' };

    if (file.size > 1 * 1024 * 1024) return { error: 'Resume must be under 1MB' };
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'docx') return { error: 'Only DOCX format is supported' };

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic bytes verification
    const hex = buffer.toString('hex', 0, 4).toUpperCase();
    if (hex !== '504B0304') {
      return { error: 'Invalid file content. Only valid DOCX documents are accepted' };
    }

    const fileName = `client-${Date.now()}.docx`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('resumes')
      .upload(fileName, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return { error: uploadError.message || 'Failed to upload to storage' };
    }

    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('resumes')
      .createSignedUrl(uploadData.path, 86400); // 24 hours (1 day)

    if (signedError) return { error: 'Failed to generate secure link' };

    return { success: true, url: signedData.signedUrl };
  } catch (err: any) {
    console.error('Server Action Crash:', err);
    return { error: err.message || 'Internal server error' };
  }
}
