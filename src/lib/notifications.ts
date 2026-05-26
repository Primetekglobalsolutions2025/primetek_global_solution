import { Resend } from 'resend';
import { supabaseAdmin } from './supabase-admin';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

/**
 * Sends a notification email using Resend.
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content?: Buffer; path?: string }>
) {
  if (!resend) {
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Primetek Portal <notifications@primetek.com>',
      to,
      subject,
      html,
      attachments,
    });

    if (error) {
      console.error('Resend Error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Email Send Crash:', err);
    return { success: false, error: err };
  }
}

/**
 * Resolves the application base URL dynamically.
 */
function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://primetek-portal.vercel.app';
}

/**
 * Template for new assignment notification.
 */
export function getAssignmentTemplate(employeeName: string, clientName: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">New Client Profile Assigned</h2>
      <p>Hi ${employeeName},</p>
      <p>A new client profile for <strong>${clientName}</strong> has been assigned to you for processing.</p>
      <div style="margin: 30px 0;">
        <a href="${getAppUrl()}/employee/assigned-profiles" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          View Assignment
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Regards,<br>Primetek Global Solutions</p>
    </div>
  `;
}

export function getLeaveStatusTemplate(employeeName: string, type: string, status: string, startDate: string, endDate: string) {
  const color = status === 'Approved' ? '#10b981' : '#ef4444';
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">Leave Request ${status}</h2>
      <p>Hi ${employeeName},</p>
      <p>Your <strong>${type} Leave</strong> request from ${startDate} to ${endDate} has been <strong style="color: ${color};">${status.toUpperCase()}</strong>.</p>
      <div style="margin: 30px 0;">
        <a href="${getAppUrl()}/employee/leaves" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          View Leave Status
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Regards,<br>Primetek Global Solutions</p>
    </div>
  `;
}

export function getWFHStatusTemplate(employeeName: string, date: string, status: string) {
  const color = status.includes('Approved') ? '#10b981' : '#ef4444';
  const label = status.includes('Approved') ? 'Approved' : 'Rejected';
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">WFH Request ${label}</h2>
      <p>Hi ${employeeName},</p>
      <p>Your <strong>Work From Home</strong> request for ${date} has been <strong style="color: ${color};">${label.toUpperCase()}</strong>.</p>
      <div style="margin: 30px 0;">
        <a href="${getAppUrl()}/employee/attendance" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Check Attendance
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Regards,<br>Primetek Global Solutions</p>
    </div>
  `;
}

export function getInterviewRequestTemplate(data: {
  consultantName: string;
  consultantPhone: string;
  consultantTechnology: string;
  clientCompany: string;
  interviewDateTime: string;
  interviewPlatform: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333; line-height: 1.6;">
      <p>I hope you are doing well.</p>
      <p>Please find the interview details below for support:</p>
      <p style="margin-bottom: 5px;"><strong>Consultant Name:</strong> ${data.consultantName}</p>
      <p style="margin-bottom: 5px;"><strong>Consultant Contact Number:</strong> ${data.consultantPhone || 'N/A'}</p>
      <p style="margin-bottom: 5px;"><strong>Consultant Technology:</strong> ${data.consultantTechnology || 'N/A'}</p>
      <p style="margin-bottom: 5px;"><strong>Client/Company:</strong> ${data.clientCompany}</p>
      <p style="margin-bottom: 5px;"><strong>Interview Date & Time (EST):</strong> ${data.interviewDateTime}</p>
      <p style="margin-bottom: 5px;"><strong>Interview Platform:</strong> ${data.interviewPlatform}</p>
      <br>
      <p>Kindly find my resume attached for your reference.</p>
      <p>Please let me know if any additional information is required</p>
    </div>
  `;
}

/**
 * Template for leave request notification sent to admins.
 */
export function getAdminLeaveRequestTemplate(employeeName: string, type: string, startDate: string, endDate: string, reason: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">New Leave Request Submitted</h2>
      <p><strong>Employee:</strong> ${employeeName}</p>
      <p><strong>Leave Type:</strong> ${type} Leave</p>
      <p><strong>Duration:</strong> ${startDate} to ${endDate}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <div style="margin: 30px 0;">
        <a href="${getAppUrl()}/admin/approvals" 
           style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Go to Approval Queue
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Regards,<br>Primetek Portal</p>
    </div>
  `;
}

/**
 * Template for WFH request notification sent to admins.
 */
export function getAdminWFHRequestTemplate(employeeName: string, date: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">New WFH Request Submitted</h2>
      <p><strong>Employee:</strong> ${employeeName}</p>
      <p><strong>Requested Date:</strong> ${date}</p>
      <div style="margin: 30px 0;">
        <a href="${getAppUrl()}/admin/approvals" 
           style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Go to Approval Queue
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Regards,<br>Primetek Portal</p>
    </div>
  `;
}

/**
 * Template for contact inquiry notification sent to admins.
 */
export function getAdminInquiryTemplate(name: string, email: string, phone: string | null, company: string | null, message: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">New Contact Inquiry Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Company:</strong> ${company || 'N/A'}</p>
      <p><strong>Message:</strong></p>
      <p style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-style: italic;">${message}</p>
      <div style="margin: 30px 0;">
        <a href="${getAppUrl()}/admin/inquiries" 
           style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          View Inquiries
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Regards,<br>Primetek Portal</p>
    </div>
  `;
}

/**
 * Dispatches an email notification to all registered admins if the corresponding preference key is enabled.
 */
export async function notifyAdminsIfEnabled(
  prefKey: string,
  subject: string,
  html: string
) {
  try {
    // Check if notifications are enabled for this key
    const { data: config } = await supabaseAdmin
      .from('portal_config')
      .select('config_value')
      .eq('config_key', prefKey)
      .maybeSingle();

    // Default to true if config key doesn't exist
    const isEnabled = config ? config.config_value !== 'false' : true;
    if (!isEnabled) return { success: true, reason: 'Disabled by configuration' };

    // Fetch admin emails
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('email');

    if (adminError || !admins || admins.length === 0) {
      console.log('No admin users found to notify.');
      return { success: false, reason: 'No admin users found' };
    }

    // Send emails in parallel
    const results = await Promise.all(
      admins.map((admin) => sendNotificationEmail(admin.email, subject, html))
    );

    return { success: true, results };
  } catch (err) {
    console.error('Failed to notify admins:', err);
    return { success: false, error: err };
  }
}

