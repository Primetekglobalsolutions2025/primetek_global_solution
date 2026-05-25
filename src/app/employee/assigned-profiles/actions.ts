'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getAssignedProfiles() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('application_profiles')
    .select('*')
    .eq('assigned_to', session.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateProfileStatus(id: string, status: string) {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const { error } = await supabaseAdmin
    .from('application_profiles')
    .update({ status })
    .eq('id', id)
    .eq('assigned_to', session.id);

  if (error) throw error;
  revalidatePath('/employee/assigned-profiles');
  return { success: true };
}

export async function submitInterviewRequest(formData: FormData) {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const profileId = formData.get('profile_id') as string;
  const clientCompany = formData.get('client_company') as string;
  const interviewDatetime = formData.get('interview_datetime') as string;
  const interviewPlatform = formData.get('interview_platform') as string;
  const resumeType = formData.get('resume_type') as string; // 'original' or 'updated'

  if (!profileId || !clientCompany || !interviewDatetime || !interviewPlatform) {
    throw new Error('Missing required fields');
  }

  // Fetch profile to verify assignment and get details
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('application_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('assigned_to', session.id)
    .single();

  if (pErr || !profile) {
    throw new Error('Profile not found or not assigned to you');
  }

  let updatedResumeUrl = null;

  if (resumeType === 'updated') {
    const file = formData.get('resume') as File | null;
    if (!file || file.size === 0) {
      throw new Error('Updated resume file is required');
    }
    
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Resume file size must be less than 2MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Ext check
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(fileExt || '')) {
      throw new Error('Invalid file type. Only PDF, DOC, or DOCX files are allowed.');
    }

    const fileName = `updated-resume-${Date.now()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('resumes')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      throw new Error('Failed to upload updated resume to storage.');
    }

    // Generate signed URL
    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('resumes')
      .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365); // 1 year

    if (signedError) {
      throw new Error('Failed to generate URL for updated resume.');
    }

    updatedResumeUrl = signedData.signedUrl;
  }

  // Save the interview request
  const { data: requestRecord, error: insertError } = await supabaseAdmin
    .from('interview_requests')
    .insert({
      profile_id: profileId,
      employee_id: session.id,
      consultant_name: profile.client_name,
      consultant_phone: profile.client_phone,
      consultant_technology: profile.client_role,
      client_company: clientCompany,
      interview_datetime: new Date(interviewDatetime).toISOString(),
      interview_platform: interviewPlatform,
      resume_type: resumeType,
      updated_resume_url: updatedResumeUrl,
      status: 'pending'
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert Interview Request Error:', insertError);
    throw new Error('Failed to save interview request.');
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
    consultantTechnology: profile.client_role || 'N/A',
    clientCompany,
    interviewDateTime: estDateStr,
    interviewPlatform
  });

  // Prepare email attachments
  let attachments = undefined;
  if (resumeType === 'updated') {
    const file = formData.get('resume') as File | null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments = [{
        filename: file.name,
        content: buffer
      }];
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
        attachments = [{
          filename: `Resume_${(profile.client_name || 'consultant').replace(/\s+/g, '_')}.${fileExt}`,
          content: buffer
        }];
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
    attachments
  );

  if (!emailRes.success) {
    console.error('Failed to send interview request email:', emailRes.error);
  }

  revalidatePath('/employee/assigned-profiles');
  return { success: true };
}
