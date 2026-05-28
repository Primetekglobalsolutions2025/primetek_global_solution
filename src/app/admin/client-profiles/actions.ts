'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { sendNotificationEmail, getAssignmentTemplate } from '@/lib/notifications';
import { clientProfileSchema } from '@/lib/validations';

export async function getAllProfiles() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('application_profiles')
    .select(`
      *,
      assigned_employee:employees(id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return data;
}

export async function createProfile(formData: any) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    // Validate and strip unknown fields to prevent mass-assignment
    const parsed = clientProfileSchema.safeParse(formData);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { error: `Validation failed: ${issues}` };
    }
    const validatedData = parsed.data;

    const { error, data } = await supabaseAdmin
      .from('application_profiles')
      .insert([validatedData])
      .select()
      .single();

    if (error) {
      console.error('Create Profile Error:', error);
      return { error: error.message || 'Database error occurred' };
    }

    // Log the action
    await logAuditAction('CREATE_PROFILE', 'application_profiles', data.id, null, validatedData);

    // If assigned to an employee, send a notification
    if (validatedData.assigned_to) {
      const { data: employee } = await supabaseAdmin.from('employees').select('name, email').eq('id', validatedData.assigned_to).single();
      if (employee) {
        const emailRes = await sendNotificationEmail(
          employee.email, 
          'New Assignment: ' + validatedData.client_name, 
          getAssignmentTemplate(employee.name, validatedData.client_name || '')
        );
        const emailResAsAny = emailRes as any;
        if (!emailResAsAny.success) {
          console.warn(`[Email Delivery Failed] action: createProfile, error: ${emailResAsAny.error || emailResAsAny.reason}`);
          await logAuditAction('EMAIL_DELIVERY_FAILED', 'application_profiles', data.id, null, {
            recipient: employee.email,
            subject: 'New Assignment: ' + validatedData.client_name,
            error: emailResAsAny.error || emailResAsAny.reason
          });
        }
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
    await verifyActiveAdmin(session.id);

    // Validate and strip unknown fields to prevent mass-assignment
    const parsed = clientProfileSchema.partial().safeParse(formData);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { error: `Validation failed: ${issues}` };
    }
    const validatedData = parsed.data;

    // Fetch old data for audit
    const { data: oldData } = await supabaseAdmin.from('application_profiles').select('*').eq('id', id).single();

    const { error } = await supabaseAdmin
      .from('application_profiles')
      .update(validatedData)
      .eq('id', id);

    if (error) {
      console.error('Update Profile Error:', error);
      return { error: error.message || 'Database error occurred' };
    }

    // Log the action
    await logAuditAction('UPDATE_PROFILE', 'application_profiles', id, oldData, validatedData);

    // If assignment changed, notify new employee
    if (validatedData.assigned_to && validatedData.assigned_to !== oldData?.assigned_to) {
      const { data: employee } = await supabaseAdmin.from('employees').select('name, email').eq('id', validatedData.assigned_to).single();
      if (employee) {
        const emailRes = await sendNotificationEmail(
          employee.email, 
          'New Assignment: ' + (validatedData.client_name || oldData?.client_name || ''), 
          getAssignmentTemplate(employee.name, validatedData.client_name || oldData?.client_name || '')
        );
        const emailResAsAny = emailRes as any;
        if (!emailResAsAny.success) {
          console.warn(`[Email Delivery Failed] action: updateProfile, error: ${emailResAsAny.error || emailResAsAny.reason}`);
          await logAuditAction('EMAIL_DELIVERY_FAILED', 'application_profiles', id, null, {
            recipient: employee.email,
            subject: 'New Assignment: ' + (validatedData.client_name || oldData?.client_name || ''),
            error: emailResAsAny.error || emailResAsAny.reason
          });
        }
      }
    }

    revalidatePath('/admin/client-profiles');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Internal server error' };
  }
}

export async function deleteProfile(id: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    if (!id) return { error: 'Profile ID is required' };

    // Fetch data for audit before deleting
    const { data: oldData, error: fetchError } = await supabaseAdmin
      .from('application_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !oldData) {
      console.error('Fetch profile for deletion error:', fetchError);
      return { error: 'Profile not found' };
    }

    // Delete the profile directly — don't cascade-delete the parent application
    const { error: deleteError } = await supabaseAdmin
      .from('application_profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete profile error:', deleteError);
      return { error: deleteError.message || 'Failed to delete client profile' };
    }

    // Log the action
    await logAuditAction('DELETE_PROFILE', 'application_profiles', id, oldData, null);

    // If the profile has a resume, delete it from storage as well to prevent storage leak
    if (oldData.resume_url && oldData.resume_url.includes('path=')) {
      try {
        const urlObj = new URL(oldData.resume_url, 'http://localhost');
        const path = urlObj.searchParams.get('path');
        if (path) {
          const { error: storageDeleteError } = await supabaseAdmin
            .storage
            .from('resumes')
            .remove([path]);
          if (storageDeleteError) {
            console.error('[deleteProfile] Failed to delete resume from storage:', storageDeleteError);
          }
        }
      } catch (storageErr) {
        console.error('[deleteProfile] Error parsing storage path from resume_url:', storageErr);
      }
    }

    revalidatePath('/admin/client-profiles');
    return { success: true };
  } catch (err: any) {
    console.error('deleteProfile server action crashed:', err);
    return { error: err.message || 'Internal server error' };
  }
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
    await verifyActiveAdmin(session.id);

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

    return { success: true, url: `/api/resumes/download?path=${encodeURIComponent(uploadData.path)}` };
  } catch (err: any) {
    console.error('Server Action Crash:', err);
    return { error: err.message || 'Internal server error' };
  }
}
