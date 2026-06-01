'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';

export async function getAssignedProfiles() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('application_profiles')
    .select('id, client_name, client_email, client_phone, client_role, client_address, client_linkedin, education_details, assigned_to, resume_url, status')
    .eq('assigned_to', session.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateProfileStatus(id: string, status: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    await verifyActiveSession(session.id);

    // MED-05: Restrict to employee-allowed statuses
    const ALLOWED_STATUSES = ['assigned', 'processing', 'completed', 'rejected'];
    if (!ALLOWED_STATUSES.includes(status)) {
      return { success: false, error: 'Invalid status. Employees can only set status to assigned, processing, completed, or rejected.' };
    }

    const { error } = await supabaseAdmin
      .from('application_profiles')
      .update({ status })
      .eq('id', id)
      .eq('assigned_to', session.id);

    if (error) {
      console.error('Error updating profile status:', error);
      return { success: false, error: 'Failed to update profile status' };
    }
    revalidatePath('/employee/assigned-profiles');
    return { success: true };
  } catch (err: any) {
    console.error('updateProfileStatus crashed:', err);
    return { success: false, error: err.message || 'Failed to update profile status' };
  }
}

export async function submitInterviewRequest(formData: FormData) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    await verifyActiveSession(session.id);

    const profileId = formData.get('profile_id') as string;
    const clientCompany = formData.get('client_company') as string;
    const jobTitle = formData.get('job_title') as string;
    const interviewDatetime = formData.get('interview_datetime') as string;
    const interviewPlatform = formData.get('interview_platform') as string;
    const resumeType = formData.get('resume_type') as string; // 'original' or 'updated'

    if (!profileId || !clientCompany || !jobTitle || !interviewDatetime || !interviewPlatform) {
      return { success: false, error: 'Missing required fields' };
    }

    // Fetch profile to verify assignment and get details
    const { data: profile, error: pErr } = await supabaseAdmin
      .from('application_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('assigned_to', session.id)
      .single();

    if (pErr || !profile) {
      return { success: false, error: 'Profile not found or not assigned to you' };
    }

    let updatedResumeUrl = null;
    let fileBuffer: Buffer | null = null;

    if (resumeType === 'updated') {
      const file = formData.get('resume') as File | null;
      if (!file || file.size === 0) {
        return { success: false, error: 'Updated resume file is required' };
      }
      
      if (file.size > 2 * 1024 * 1024) {
        return { success: false, error: 'Resume file size must be less than 2MB' };
      }

      // MED-20: Read file buffer once
      const arrayBuffer = await file.arrayBuffer();
      const currentBuffer = Buffer.from(arrayBuffer);
      fileBuffer = currentBuffer;
      
      // Ext check
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(fileExt || '')) {
        return { success: false, error: 'Invalid file type. Only PDF, DOC, or DOCX files are allowed.' };
      }

      // Verify file content headers (magic bytes) to prevent executable spoofing
      const fileHex = currentBuffer.toString('hex', 0, 4).toUpperCase();
      if (fileExt === 'pdf' && fileHex !== '25504446') {
        return { success: false, error: 'Invalid PDF content signature.' };
      }
      if (fileExt === 'docx' && fileHex !== '504B0304') {
        return { success: false, error: 'Invalid DOCX content signature.' };
      }
      if (fileExt === 'doc' && fileHex !== 'D0CF11E0') {
        return { success: false, error: 'Invalid DOC content signature.' };
      }

      const fileName = `updated-resume-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('resumes')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) {
        console.error('Storage Upload Error:', uploadError);
        return { success: false, error: 'Failed to upload updated resume to storage.' };
      }

      updatedResumeUrl = `/api/resumes/download?path=${encodeURIComponent(uploadData.path)}`;
    }

    // Handle JD File (.docx only)
    const jdFile = formData.get('jd') as File | null;
    if (!jdFile || jdFile.size === 0) {
      return { success: false, error: 'Job Description (JD) document is required.' };
    }

    if (jdFile.size > 2 * 1024 * 1024) {
      return { success: false, error: 'JD file size must be less than 2MB' };
    }

    const jdExt = jdFile.name.split('.').pop()?.toLowerCase();
    if (jdExt !== 'docx') {
      return { success: false, error: 'Invalid JD file type. Only DOCX files are allowed.' };
    }

    const jdArrayBuffer = await jdFile.arrayBuffer();
    const jdFileBuffer = Buffer.from(jdArrayBuffer);

    // Magic bytes check for DOCX/ZIP (PK.. -> 504B0304)
    const jdHex = jdFileBuffer.toString('hex', 0, 4).toUpperCase();
    if (jdHex !== '504B0304') {
      return { success: false, error: 'Invalid JD file content. Only real DOCX documents are accepted.' };
    }

    const jdFileName = `jd-${Date.now()}.docx`;
    const { data: jdUploadData, error: jdUploadError } = await supabaseAdmin
      .storage
      .from('resumes')
      .upload(jdFileName, jdFileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });

    if (jdUploadError) {
      console.error('JD Storage Upload Error:', jdUploadError);
      return { success: false, error: 'Failed to upload JD document to storage.' };
    }

    const jdUrl = `/api/resumes/download?path=${encodeURIComponent(jdUploadData.path)}`;

    // Save the interview request
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from('interview_requests')
      .insert({
        profile_id: profileId,
        employee_id: session.id,
        consultant_name: profile.client_name,
        consultant_phone: profile.client_phone,
        consultant_technology: jobTitle,
        client_company: clientCompany,
        interview_datetime: new Date(interviewDatetime).toISOString(),
        interview_platform: interviewPlatform,
        resume_type: resumeType,
        updated_resume_url: updatedResumeUrl,
        jd_url: jdUrl,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert Interview Request Error:', insertError);
      return { success: false, error: 'Failed to save interview request.' };
    }

    // Find admin/HR user to notify
    const { data: adminUser } = await supabaseAdmin
      .from('employees')
      .select('email')
      .eq('role', 'hr')
      .eq('status', 'Active')
      .limit(1)
      .single();

    const adminEmail = adminUser?.email || 'admin@primetek.com';

    // Format date/time to EST
    const estDateStr = new Date(interviewDatetime).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short'
    }) + ' (EST)';

    // Build HTML email using the template
    const { getInterviewRequestTemplate, sendNotificationEmail } = await import('@/lib/notifications');
    const html = getInterviewRequestTemplate({
      consultantName: profile.client_name || 'N/A',
      consultantPhone: profile.client_phone || 'N/A',
      consultantTechnology: jobTitle || 'N/A',
      clientCompany,
      interviewDateTime: estDateStr,
      interviewPlatform
    });

    // Prepare email attachments (JD first, then Resume)
    const attachments: Array<{ filename: string; content?: Buffer; path?: string }> = [];

    // Attach JD Document
    if (jdFile && jdFileBuffer) {
      attachments.push({
        filename: jdFile.name,
        content: jdFileBuffer
      });
    }

    // Attach Resume Document
    if (resumeType === 'updated') {
      const file = formData.get('resume') as File | null;
      if (file && fileBuffer) {
        attachments.push({
          filename: file.name,
          content: fileBuffer
        });
      }
    } else if (profile.resume_url) {
      try {
        let path = profile.resume_url;
        if (path.includes('resumes/')) {
          path = path.split('resumes/').pop()?.split('?')[0] || path;
        }
        const { data: fileBlob, error: downloadError } = await supabaseAdmin
          .storage
          .from('resumes')
          .download(path);
        
        if (!downloadError && fileBlob) {
          const arrayBuffer = await fileBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileExt = path.split('.').pop() || 'docx';
          attachments.push({
            filename: `Resume_${(profile.client_name || 'consultant').replace(/\s+/g, '_')}.${fileExt}`,
            content: buffer
          });
        }
      } catch (e) {
        console.warn('Could not attach original resume to email:', e);
      }
    }

    // Send notification email
    const emailRes = await sendNotificationEmail(
      adminEmail,
      `Support Interview Request: ${profile.client_name} for ${clientCompany}`,
      html,
      attachments.length > 0 ? attachments : undefined
    );
    const emailResAsAny = emailRes as any;
    if (!emailResAsAny.success) {
      console.warn(`[Email Delivery Failed] action: submitInterviewRequest, error: ${emailResAsAny.error || emailResAsAny.reason}`);
      await logAuditAction('EMAIL_DELIVERY_FAILED', 'interview_requests', newRequest?.id || profileId, null, {
        recipient: adminEmail,
        subject: `Support Interview Request: ${profile.client_name} for ${clientCompany}`,
        error: emailResAsAny.error || emailResAsAny.reason
      });
    }

    // Dispatch in-app notification to admins
    try {
      const { dispatchNotification } = await import('@/lib/notifications/dispatch');
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('id', session.id)
        .single();
      
      await dispatchNotification({
        title: `🤝 New Interview Request - ${profile.client_name}`,
        message: `${employee?.name || 'An employee'} requested support for ${profile.client_name} at ${clientCompany}.`,
        type: 'interview_requested',
        clickActionUrl: '/admin/interview-requests',
        senderName: employee?.name || 'Employee'
      });
    } catch (notifErr) {
      console.error('Failed to dispatch in-app notification:', notifErr);
    }

    revalidatePath('/employee/assigned-profiles');
    return { success: true };
  } catch (err: any) {
    console.error('submitInterviewRequest crashed:', err);
    return { success: false, error: err.message || 'Failed to submit interview request' };
  }
}
