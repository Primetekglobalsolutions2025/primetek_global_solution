'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export interface AdminWFHRequest {
  id: string;
  employee_id: string | null;
  employee_name?: string;
  employee_email?: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAdminWFHRequests() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') throw new Error('Unauthorized');
    await verifyActiveAdmin(session.id);

    const { data: requests, error } = await supabaseAdmin
      .from('wfh_requests')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) throw error;

    // Get list of employee IDs to fetch details
    const empIds = (requests || [])
      .map(r => r.employee_id)
      .filter(Boolean);

    const { data: employees } = empIds.length > 0
      ? await supabaseAdmin
          .from('employees')
          .select('id, name, email')
          .in('id', empIds)
      : { data: [] };

    const empMap = (employees || []).reduce<Record<string, { name: string; email: string }>>((acc, emp) => {
      acc[emp.id] = { name: emp.name, email: emp.email };
      return acc;
    }, {});

    const enriched = (requests || []).map(r => ({
      ...r,
      employee_name: r.employee_id ? empMap[r.employee_id]?.name || 'Unknown Employee' : 'Global (All Employees)',
      employee_email: r.employee_id ? empMap[r.employee_id]?.email || '' : '',
    }));

    return enriched as AdminWFHRequest[];
  } catch (err) {
    console.error('Error fetching admin WFH requests:', err);
    return [];
  }
}

export async function createWFHOverride(data: {
  employee_id: string | null; // null = all employees (global)
  start_date: string;
  end_date: string;
  reason: string;
}) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (start > end) {
      return { success: false, error: 'Start date cannot be after end date' };
    }

    // Check if session.id exists in employees to avoid foreign key constraint violation (admins are in admin_users, not employees)
    const { data: isEmployee } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('id', session.id)
      .maybeSingle();

    const { data: request, error } = await supabaseAdmin
      .from('wfh_requests')
      .insert([{
        employee_id: data.employee_id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason,
        status: 'Approved',
        approved_by: isEmployee ? session.id : null
      }])
      .select()
      .single();

    if (error) throw error;

    // Log audit action
    await logAuditAction(
      'CREATE_WFH_OVERRIDE',
      'wfh_requests',
      request.id,
      null,
      data
    );

    // If it's a global override, notify all employees via email or in-app notification if needed.
    if (!data.employee_id) {
      try {
        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('id, name, email')
          .eq('status', 'Active');

        // Create broadcast notification
        await supabaseAdmin
          .from('notifications')
          .insert([{
            title: '⚠️ Company-wide Work From Home (WFH) Active',
            message: `A global WFH override has been scheduled from ${data.start_date} to ${data.end_date}. Reason: ${data.reason}. You can clock in from home/anywhere during these dates.`,
            type: 'announcement',
            sender_name: 'Admin'
          }]);
          
        // Revalidate notification paths
        revalidatePath('/employee/dashboard');
      } catch (broadcastErr) {
        console.error('Failed to dispatch global WFH broadcast notifications:', broadcastErr);
      }
    }

    revalidatePath('/admin/wfh');
    revalidatePath('/employee/leaves');
    revalidatePath('/employee/attendance');
    return { success: true, request };
  } catch (err: any) {
    console.error('Error creating WFH override:', err);
    return { success: false, error: err.message || 'Failed to create override' };
  }
}

export async function updateWFHRequestStatus(id: string, status: 'Approved' | 'Rejected') {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    const { data: request, error: fetchError } = await supabaseAdmin
      .from('wfh_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) return { success: false, error: 'Request not found' };

    if (request.status !== 'Pending') {
      return { success: false, error: `Request has already been processed with status: ${request.status}` };
    }

    // Check if session.id exists in employees to avoid foreign key constraint violation (admins are in admin_users, not employees)
    const { data: isEmployee } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('id', session.id)
      .maybeSingle();

    const { data: updated, error } = await supabaseAdmin
      .from('wfh_requests')
      .update({
        status,
        approved_by: isEmployee ? session.id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAuditAction(
      status === 'Approved' ? 'APPROVE_WFH_DATE_REQUEST' : 'REJECT_WFH_DATE_REQUEST',
      'wfh_requests',
      id,
      { status: 'Pending' },
      { status }
    );

    // Send email notification to employee
    try {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('name, email')
        .eq('id', request.employee_id)
        .single();

      if (employee?.email) {
        const { sendNotificationEmail } = await import('@/lib/notifications');
        const html = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>WFH Date Request ${status}</h2>
            <p>Hello ${employee.name},</p>
            <p>Your Work From Home request for dates <strong>${request.start_date} to ${request.end_date}</strong> has been <strong>${status.toLowerCase()}</strong>.</p>
            <p>Please log into the HR portal for details.</p>
          </div>
        `;
        await sendNotificationEmail(employee.email, `WFH Date Request ${status}`, html);
      }
    } catch (emailErr) {
      console.error('Failed to notify employee of WFH request status change:', emailErr);
    }

    // Dispatch Web Push notification to the employee
    try {
      const notificationType = status === 'Approved' ? 'leave_approved' : 'leave_rejected';
      await dispatchNotification({
        title: `WFH Date Request ${status}`,
        message: `Your pre-planned Work From Home request for ${request.start_date} to ${request.end_date} has been ${status.toLowerCase()}.`,
        type: notificationType,
        employeeId: request.employee_id,
        clickActionUrl: '/employee/leaves'
      });
    } catch (pushErr: any) {
      console.warn(`[Push Delivery Failed] action: updateWFHRequestStatus, error: ${pushErr.message}`);
    }

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/wfh');
    revalidatePath('/employee/leaves');
    return { success: true, request: updated };
  } catch (err: any) {
    console.error('Error updating WFH request status:', err);
    return { success: false, error: err.message || 'Failed to update request status' };
  }
}

export async function updateWFHRequest(id: string, data: {
  start_date: string;
  end_date: string;
  reason: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
}) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (start > end) {
      return { success: false, error: 'Start date cannot be after end date' };
    }

    // Check if session.id exists in employees to avoid foreign key constraint violation
    const { data: isEmployee } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('id', session.id)
      .maybeSingle();

    const { data: originalRequest, error: fetchErr } = await supabaseAdmin
      .from('wfh_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !originalRequest) {
      return { success: false, error: 'Request not found' };
    }

    const updates: any = {
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      updated_at: new Date().toISOString()
    };

    if (data.status) {
      updates.status = data.status;
      if (data.status === 'Approved') {
        updates.approved_by = isEmployee ? session.id : null;
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('wfh_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAuditAction(
      'UPDATE_WFH_REQUEST',
      'wfh_requests',
      id,
      originalRequest,
      updates
    );

    // If status changed to Approved or Rejected, send notification
    if (data.status && data.status !== originalRequest.status) {
      // Send email notification to employee
      try {
        const { data: employee } = await supabaseAdmin
          .from('employees')
          .select('name, email')
          .eq('id', originalRequest.employee_id)
          .single();

        if (employee?.email) {
          const { sendNotificationEmail } = await import('@/lib/notifications');
          const html = `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>WFH Date Request ${data.status}</h2>
              <p>Hello ${employee.name},</p>
              <p>Your Work From Home request dates have been updated and the request is now <strong>${data.status.toLowerCase()}</strong>.</p>
              <p><strong>New Dates:</strong> ${data.start_date} to ${data.end_date}</p>
              <p>Please log into the HR portal for details.</p>
            </div>
          `;
          await sendNotificationEmail(employee.email, `WFH Date Request ${data.status}`, html);
        }
      } catch (emailErr) {
        console.error('Failed to notify employee of WFH request status change:', emailErr);
      }

      // Dispatch Web Push notification to the employee
      try {
        const notificationType = data.status === 'Approved' ? 'leave_approved' : 'leave_rejected';
        await dispatchNotification({
          title: `WFH Date Request ${data.status}`,
          message: `Your pre-planned Work From Home request has been updated to ${data.start_date} to ${data.end_date} and is now ${data.status.toLowerCase()}.`,
          type: notificationType,
          employeeId: originalRequest.employee_id,
          clickActionUrl: '/employee/leaves'
        });
      } catch (pushErr: any) {
        console.warn(`[Push Delivery Failed] action: updateWFHRequest, error: ${pushErr.message}`);
      }
    }

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/wfh');
    revalidatePath('/employee/leaves');
    return { success: true, request: updated };
  } catch (err: any) {
    console.error('Error updating WFH request:', err);
    return { success: false, error: err.message || 'Failed to update WFH request' };
  }
}

export async function getActiveEmployees() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') throw new Error('Unauthorized');
    await verifyActiveAdmin(session.id);

    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('status', 'Active')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching active employees:', err);
    return [];
  }
}
