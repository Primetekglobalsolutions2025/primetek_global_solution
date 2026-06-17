'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export interface WFHRequest {
  id: string;
  employee_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getEmployeeWFHRequests() {
  try {
    const session = await getSession();
    if (!session || !session.id) return [];
    await verifyActiveSession(session.id);

    // Fetch individual requests for the logged-in employee, and global overrides (employee_id is null)
    const { data, error } = await supabaseAdmin
      .from('wfh_requests')
      .select('*')
      .or(`employee_id.eq.${session.id},employee_id.is.null`)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return (data || []) as WFHRequest[];
  } catch (err) {
    console.error('Error fetching employee WFH requests:', err);
    return [];
  }
}

export async function submitWFHRequest(formData: {
  start_date: string;
  end_date: string;
  reason: string;
}) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    await verifyActiveSession(session.id);

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days < 1) {
      return { success: false, error: 'Invalid date range' };
    }

    // Check for overlapping requests
    const { data: overlaps, error: overlapError } = await supabaseAdmin
      .from('wfh_requests')
      .select('id')
      .eq('employee_id', session.id)
      .in('status', ['Pending', 'Approved'])
      .gte('end_date', formData.start_date)
      .lte('start_date', formData.end_date);

    if (overlapError) throw overlapError;
    if (overlaps && overlaps.length > 0) {
      return { success: false, error: 'You have an overlapping WFH request for this date range.' };
    }

    const { data, error } = await supabaseAdmin
      .from('wfh_requests')
      .insert([{
        employee_id: session.id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        status: 'Pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // Log audit action
    await logAuditAction(
      'SUBMIT_WFH_REQUEST',
      'wfh_requests',
      data.id,
      null,
      { start_date: formData.start_date, end_date: formData.end_date }
    );

    // Notify admins if needed
    try {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('id', session.id)
        .single();
      const employeeName = employee?.name || 'An employee';

      const { notifyAdminsIfEnabled } = await import('@/lib/notifications');
      const html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>New WFH Date Request</h2>
          <p><strong>Employee:</strong> ${employeeName}</p>
          <p><strong>Dates:</strong> ${formData.start_date} to ${formData.end_date} (${days} day(s))</p>
          <p><strong>Reason:</strong> ${formData.reason}</p>
          <p>Please log into the HR portal to approve or reject this request.</p>
        </div>
      `;
      await notifyAdminsIfEnabled('notif_wfh', `New WFH Date Request - ${employeeName}`, html);

      // Web Push notification to admins
      try {
        const { data: admins } = await supabaseAdmin.from('admin_users').select('id');
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await dispatchNotification({
              title: `New WFH Request`,
              message: `${employeeName} requested WFH from ${formData.start_date} to ${formData.end_date}.`,
              type: 'leave_approval_required',
              adminId: admin.id,
              clickActionUrl: '/admin/approvals'
            });
          }
        }
      } catch (pushErr) {
        const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
        console.warn(`[Push Delivery Failed] action: submitWFHRequest, error: ${msg}`);
      }
    } catch (notifErr) {
      console.error('Failed to send WFH request notification:', notifErr);
    }

    revalidatePath('/employee/leaves');
    return { success: true, request: data };
  } catch (err) {
    console.error('Error submitting WFH request:', err);
    const msg = err instanceof Error ? err.message : 'Failed to submit WFH request';
    return { success: false, error: msg };
  }
}
