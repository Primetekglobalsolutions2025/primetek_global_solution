'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { sendNotificationEmail, getLeaveStatusTemplate, getWFHStatusTemplate } from '@/lib/notifications';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export async function getPendingApprovals() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) {
    return { leaves: [], wfh: [], wfhRequests: [] };
  }
  await verifyActiveAdmin(session.id);

  try {
    // 1. Fetch Pending Leaves - Use a more resilient join or manual mapping if needed
    const { data: leaves, error: leavesError } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .ilike('status', 'Pending') // Case-insensitive status check
      .order('created_at', { ascending: false });

    if (leavesError) throw leavesError;

    // 2. Fetch Pending WFH Sessions
    const { data: wfh, error: wfhError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .ilike('status', 'Pending WFH') // Case-insensitive status check
      .order('date', { ascending: false });

    if (wfhError) throw wfhError;

    // 3. Fetch Pending WFH Date Requests
    let wfhRequests = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('wfh_requests')
        .select('*')
        .ilike('status', 'Pending')
        .order('start_date', { ascending: false });
      
      if (!error && data) {
        wfhRequests = data;
      }
    } catch (wfhReqErr) {
      console.warn('wfh_requests table query failed. It might not be migrated yet.');
    }

    // 4. Enrich with Employee Names (Batch query to avoid join issues)
    const allEmpIds = Array.from(new Set([
      ...(leaves || []).map(l => l.employee_id),
      ...(wfh || []).map(w => w.employee_id),
      ...wfhRequests.map(r => r.employee_id)
    ])).filter(Boolean);

    const { data: employees } = allEmpIds.length > 0
      ? await supabaseAdmin
          .from('employees')
          .select('id, name, email')
          .in('id', allEmpIds)
      : { data: [] };

    const empMap = (employees || []).reduce<Record<string, { id: string; name: string; email: string }>>((acc, emp) => {
      acc[emp.id] = emp;
      return acc;
    }, {});

    return {
      leaves: (leaves || []).map((l: any) => ({ 
        ...l, 
        employee_name: empMap[l.employee_id]?.name || 'Unknown Employee',
        employee_email: empMap[l.employee_id]?.email
      })),
      wfh: (wfh || []).map((w: any) => ({ 
        ...w, 
        employee_name: empMap[w.employee_id]?.name || 'Unknown Employee',
        employee_email: empMap[w.employee_id]?.email,
        lat: w.lat !== null && w.lat !== undefined ? Number(w.lat) : 0,
        lng: w.lng !== null && w.lng !== undefined ? Number(w.lng) : 0,
      })),
      wfhRequests: wfhRequests.map((r: any) => ({
        ...r,
        employee_name: empMap[r.employee_id]?.name || 'Unknown Employee',
        employee_email: empMap[r.employee_id]?.email
      }))
    };
  } catch (error) {
    console.error('Error in getPendingApprovals:', error);
    return { leaves: [], wfh: [], wfhRequests: [] };
  }
}

export async function updateLeaveStatus(id: string, status: 'Approved' | 'Rejected') {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    // 1. Get request details first for email and balance
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) return { success: false, error: 'Request not found' };

    // MED-11: Idempotency Check
    if (request.status !== 'Pending') {
      if (request.status === status) {
        return { success: true, message: `Leave request was already ${status.toLowerCase()}` };
      }
      return { success: false, error: `Leave request has already been ${request.status.toLowerCase()}` };
    }

    // Fetch employee details separately for email notifications
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('name, email')
      .eq('id', request.employee_id)
      .single();

    // 2. Process Approval or Rejection atomically
    if (status === 'Approved') {
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      const days = calculateWorkingDays(start, end);

      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('approve_leave_request_atomic', {
        p_request_id: id,
        p_days: days
      });

      if (rpcErr || (rpcRes && !rpcRes.success)) {
        console.error('RPC approve_leave_request_atomic failed:', rpcErr || rpcRes?.error);
        return { success: false, error: `Failed to approve leave request: ${rpcErr?.message || rpcRes?.error || 'Unknown error'}` };
      }
    } else {
      // Rejection: Update status atomically only if it is still Pending
      const { data: updatedRequest, error } = await supabaseAdmin
        .from('leave_requests')
        .update({ status })
        .eq('id', id)
        .eq('status', 'Pending')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Database update error during rejection:', error);
        return { success: false, error: 'Database update failed' };
      }

      if (!updatedRequest) {
        return { success: false, error: 'Leave request has already been processed.' };
      }
    }

    // Log action to audit ledger
    await logAuditAction(
      status === 'Approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      'leave_requests',
      id,
      { status: request.status, employee_name: employee?.name || 'Unknown' },
      { status }
    );

    // 4. Send Email
    if (employee?.email) {
      const html = getLeaveStatusTemplate(
        employee.name,
        request.type,
        status,
        request.start_date,
        request.end_date
      );
      const emailRes = await sendNotificationEmail(employee.email, `Leave Request ${status}`, html);
      const emailResAsAny = emailRes as any;
      if (!emailResAsAny.success) {
        console.warn(`[Email Delivery Failed] action: updateLeaveStatus, error: ${emailResAsAny.error || emailResAsAny.reason}`);
        await logAuditAction('EMAIL_DELIVERY_FAILED', 'leave_requests', id, null, {
          recipient: employee.email,
          subject: `Leave Request ${status}`,
          error: emailResAsAny.error || emailResAsAny.reason
        });
      }
    }

    // Dispatch Web Push notification to the employee
    try {
      const notificationType = status === 'Approved' ? 'leave_approved' : 'leave_rejected';
      await dispatchNotification({
        title: `Leave Request ${status}`,
        message: `Your ${request.type} leave request from ${request.start_date} to ${request.end_date} has been ${status.toLowerCase()}.`,
        type: notificationType,
        employeeId: request.employee_id,
        clickActionUrl: '/employee/leaves'
      });
    } catch (err: any) {
      console.warn(`[Push Delivery Failed] action: updateLeaveStatus, error: ${err.message}`);
    }

    revalidatePath('/admin/approvals');
    revalidatePath('/employee/leaves');
    return { success: true };
  } catch (err: any) {
    console.error('Error in updateLeaveStatus:', err);
    return { success: false, error: err.message || 'Failed to update leave status' };
  }
}

export async function updateWFHStatus(id: string, status: 'Approved WFH' | 'Rejected WFH') {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    // 1. Get request details
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) return { success: false, error: 'Request not found' };

    // MED-11: Idempotency Check
    if (request.status !== 'Pending WFH') {
      if (request.status === status) {
        return { success: true, message: `WFH request was already ${status.toLowerCase()}` };
      }
      return { success: false, error: `WFH request has already been processed with status: ${request.status}` };
    }

    // Fetch employee details separately
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('name, email')
      .eq('id', request.employee_id)
      .single();

    // 2. Call RPC to update WFH status, append event, rebuild projection, and recalculate lates atomically
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('update_wfh_status_atomic', {
      p_session_id: id,
      p_status: status,
      p_admin_id: session.id
    });

    if (rpcErr || (rpcRes && !rpcRes.success)) {
      console.error('RPC update_wfh_status_atomic failed:', rpcErr || rpcRes?.error);
      return { success: false, error: `Failed to update WFH status atomically: ${rpcErr?.message || rpcRes?.error || 'Unknown error'}` };
    }

    // Log action to audit ledger
    await logAuditAction(
      status === 'Approved WFH' ? 'APPROVE_WFH' : 'REJECT_WFH',
      'attendance',
      id,
      { status: request.status, employee_name: employee?.name || 'Unknown' },
      { status }
    );

    // 3. Send Email
    if (employee?.email) {
      const html = getWFHStatusTemplate(
        employee.name,
        request.date,
        status
      );
      const emailRes = await sendNotificationEmail(employee.email, `WFH Request ${status.includes('Approved') ? 'Approved' : 'Rejected'}`, html);
      const emailResAsAny = emailRes as any;
      if (!emailResAsAny.success) {
        console.warn(`[Email Delivery Failed] action: updateWFHStatus, error: ${emailResAsAny.error || emailResAsAny.reason}`);
        await logAuditAction('EMAIL_DELIVERY_FAILED', 'attendance', id, null, {
          recipient: employee.email,
          subject: `WFH Request ${status.includes('Approved') ? 'Approved' : 'Rejected'}`,
          error: emailResAsAny.error || emailResAsAny.reason
        });
      }
    }

    // Dispatch Web Push notification to the employee
    try {
      const notificationType = status.includes('Approved') ? 'leave_approved' : 'leave_rejected';
      const cleanStatus = status.includes('Approved') ? 'Approved' : 'Rejected';
      await dispatchNotification({
        title: `WFH Request ${cleanStatus}`,
        message: `Your Work From Home request for ${request.date} has been ${cleanStatus.toLowerCase()}.`,
        type: notificationType,
        employeeId: request.employee_id,
        clickActionUrl: '/employee/attendance'
      });
    } catch (err: any) {
      console.warn(`[Push Delivery Failed] action: updateWFHStatus, error: ${err.message}`);
    }

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/attendance');
    revalidatePath('/employee/attendance');
    return { success: true };
  } catch (err: any) {
    console.error('Error in updateWFHStatus:', err);
    return { success: false, error: err.message || 'Failed to update WFH status' };
  }
}

// Module-level helper function to calculate working days (excludes weekends)
function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

export async function getApprovalHistory() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) return [];
  await verifyActiveAdmin(session.id);

  try {
    const [{ data: leaves }, { data: wfh }] = await Promise.all([
      supabaseAdmin
        .from('leave_requests')
        .select('*')
        .in('status', ['Approved', 'Rejected'])
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('attendance')
        .select('*')
        .in('status', ['Approved WFH', 'Rejected WFH'])
        .order('date', { ascending: false })
        .limit(100),
    ]);

    const allEmpIds = Array.from(new Set([
      ...(leaves || []).map(l => l.employee_id),
      ...(wfh || []).map(w => w.employee_id),
    ])).filter(Boolean);

    const { data: employees } = allEmpIds.length > 0
      ? await supabaseAdmin
          .from('employees')
          .select('id, name, email')
          .in('id', allEmpIds)
      : { data: [] };

    const empMap = (employees || []).reduce((acc: any, emp: any) => {
      acc[emp.id] = emp;
      return acc;
    }, {});

    const leaveHistory = (leaves || []).map((l: any) => ({
      ...l,
      kind: 'leave',
      created_at: l.created_at || l.start_date,
      employee_name: empMap[l.employee_id]?.name || 'Unknown',
      employee_email: empMap[l.employee_id]?.email || '',
    }));

    const wfhHistory = (wfh || []).map((w: any) => ({
      ...w,
      kind: 'wfh',
      created_at: w.created_at || w.check_in || w.date,
      employee_name: empMap[w.employee_id]?.name || 'Unknown',
      employee_email: empMap[w.employee_id]?.email || '',
      lat: w.lat !== null && w.lat !== undefined ? Number(w.lat) : 0,
      lng: w.lng !== null && w.lng !== undefined ? Number(w.lng) : 0,
    }));

    return [...leaveHistory, ...wfhHistory].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  } catch (err) {
    console.error('Error fetching approval history:', err);
    return [];
  }
}

export async function getPendingCountOnly() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) {
    return 0;
  }
  await verifyActiveAdmin(session.id);

  try {
    const [leavesCount, wfhCount, disputesCount] = await Promise.all([
      supabaseAdmin
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .ilike('status', 'Pending'),
      supabaseAdmin
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .ilike('status', 'Pending WFH'),
      supabaseAdmin
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING')
    ]);

    let wfhRequestsCount = 0;
    try {
      const { count } = await supabaseAdmin
        .from('wfh_requests')
        .select('*', { count: 'exact', head: true })
        .ilike('status', 'Pending');
      wfhRequestsCount = count || 0;
    } catch (wfhErr) {
      // Table doesn't exist yet
    }

    return (leavesCount.count || 0) + (wfhCount.count || 0) + (disputesCount.count || 0) + wfhRequestsCount;
  } catch (err) {
    console.error('Error fetching pending counts:', err);
    return 0;
  }
}

export async function getPendingDisputes() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) return [];
  await verifyActiveAdmin(session.id);

  try {
    const { data: disputes, error } = await supabaseAdmin
      .from('disputes')
      .select(`
        *,
        employees (
          name,
          email
        ),
        attendance (
          date,
          check_in,
          check_out,
          status,
          is_late,
          late_minutes,
          deduction_applied,
          productive_hours,
          total_break_seconds
        )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (disputes || []).map((d: any) => ({
      ...d,
      employee_name: d.employees?.name || 'Unknown Employee',
      employee_email: d.employees?.email || '',
      attendance_date: d.attendance?.date || '',
      attendance_check_in: d.attendance?.check_in || '',
      attendance_check_out: d.attendance?.check_out || '',
      attendance_status: d.attendance?.status || '',
      attendance_is_late: d.attendance?.is_late || false,
      attendance_late_minutes: d.attendance?.late_minutes || 0,
      attendance_deduction: d.attendance?.deduction_applied || 0,
      attendance_productive_hours: d.attendance?.productive_hours || 0,
      attendance_total_break_seconds: d.attendance?.total_break_seconds || 0
    }));
  } catch (err) {
    console.error('Error fetching pending disputes:', err);
    return [];
  }
}

export async function resolveDispute(
  disputeId: string, 
  status: 'APPROVED' | 'REJECTED', 
  justification: string
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    if (!justification || justification.trim() === '') {
      return { success: false, error: 'A justification is required to resolve a dispute.' };
    }

    // 1. Get dispute details
    const { data: dispute, error: fetchError } = await supabaseAdmin
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (fetchError || !dispute) return { success: false, error: 'Dispute not found' };

    if (dispute.status !== 'PENDING') {
      return { success: false, error: 'Dispute has already been resolved.' };
    }

    // 2. If APPROVED, append the ADMIN_OVERRIDE event
    if (status === 'APPROVED') {
      let overrideField = 'manager_exemption';
      if (dispute.category === 'LATE_PENALTY') {
        overrideField = 'late_approved';
      } else if (dispute.category === 'GPS_AUTO_BREAK') {
        overrideField = 'manager_exemption';
      } else if (dispute.category === 'IDLE_WARNING') {
        overrideField = 'manager_exemption';
      } else if (dispute.category === 'MISSING_TIME') {
        overrideField = 'shift_override';
      }

      const { data: lastEvent } = await supabaseAdmin
        .from('attendance_events')
        .select('sequence_number')
        .eq('session_id', dispute.attendance_id)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSequence = (lastEvent?.sequence_number || 1) + 1;

      const { error: insertError } = await supabaseAdmin
        .from('attendance_events')
        .insert([{
          session_id: dispute.attendance_id,
          employee_id: dispute.employee_id,
          event_type: 'ADMIN_OVERRIDE',
          sequence_number: nextSequence,
          idempotency_key: `dispute-override-${disputeId}-${nextSequence}`,
          client_ip: '0.0.0.0',
          payload: {
            override_field: overrideField,
            old_value: false,
            new_value: true,
            reason: `Dispute approved: ${justification}`,
            admin_id: session.id,
            dispute_id: disputeId
          }
        }]);

      if (insertError) {
        console.error('Error logging override event for dispute:', insertError);
        return { success: false, error: 'Failed to append override event for dispute approval' };
      }

      const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
        p_session_id: dispute.attendance_id
      });
      if (rebuildError) {
        console.error('Error rebuilding projection in resolveDispute:', rebuildError);
        return { success: false, error: 'Projection rebuild failed' };
      }

      const { data: attendanceRecord } = await supabaseAdmin
        .from('attendance')
        .select('date')
        .eq('id', dispute.attendance_id)
        .single();

      if (attendanceRecord && attendanceRecord.date) {
        const recordDate = new Date(attendanceRecord.date);
        const year = recordDate.getFullYear();
        const month = recordDate.getMonth() + 1;
        const { error: rpcError } = await supabaseAdmin.rpc('recalculate_employee_lates_safe', {
          p_employee_id: dispute.employee_id,
          p_year: year,
          p_month: month
        });
        if (rpcError) {
          console.error('Error recalculating lates in resolveDispute:', rpcError);
        }
      }
    }

    // 3. Update dispute row
    const { error: updateError } = await supabaseAdmin
      .from('disputes')
      .update({
        status,
        admin_justification: justification,
        updated_at: new Date().toISOString()
      })
      .eq('id', disputeId);

    if (updateError) {
      console.error('Error updating dispute status:', updateError);
      return { success: false, error: 'Failed to update dispute resolution status' };
    }

    // 4. Log Audit
    await logAuditAction(
      status === 'APPROVED' ? 'APPROVE_DISPUTE' : 'REJECT_DISPUTE',
      'disputes',
      disputeId,
      { status: 'PENDING' },
      { status, justification }
    );

    // Dispatch Web Push notification to the employee
    try {
      const { data: attendanceRecord } = await supabaseAdmin
        .from('attendance')
        .select('date')
        .eq('id', dispute.attendance_id)
        .maybeSingle();

      const recordDate = attendanceRecord?.date 
        ? new Date(attendanceRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
        : 'shift';
      const notificationType = status === 'APPROVED' ? 'leave_approved' : 'leave_rejected';
      const cleanStatus = status === 'APPROVED' ? 'Approved' : 'Rejected';
      await dispatchNotification({
        title: `Dispute ${cleanStatus}`,
        message: `Your dispute for attendance on ${recordDate} has been ${cleanStatus.toLowerCase()}. Reason: "${justification}".`,
        type: notificationType,
        employeeId: dispute.employee_id,
        clickActionUrl: '/employee/attendance'
      });
    } catch (pushErr: any) {
      console.warn(`[Push Delivery Failed] action: resolveDispute, error: ${pushErr.message}`);
    }

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/attendance');
    revalidatePath('/employee/attendance');

    return { success: true };
  } catch (err: any) {
    console.error('Error in resolveDispute:', err);
    return { success: false, error: err.message || 'Failed to resolve dispute' };
  }
}
