'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { sendNotificationEmail, getLeaveStatusTemplate, getWFHStatusTemplate } from '@/lib/notifications';

export async function getPendingApprovals() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { leaves: [], wfh: [] };
  }

  try {
    // 1. Fetch Pending Leaves - Use a more resilient join or manual mapping if needed
    const { data: leaves, error: leavesError } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .ilike('status', 'Pending') // Case-insensitive status check
      .order('created_at', { ascending: false });

    if (leavesError) throw leavesError;

    // 2. Fetch Pending WFH
    const { data: wfh, error: wfhError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .ilike('status', 'Pending WFH') // Case-insensitive status check
      .order('date', { ascending: false });

    if (wfhError) throw wfhError;

    // 3. Enrich with Employee Names (Batch query to avoid join issues)
    const allEmpIds = Array.from(new Set([
      ...(leaves || []).map(l => l.employee_id),
      ...(wfh || []).map(w => w.employee_id)
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
      }))
    };
  } catch (error) {
    console.error('Error in getPendingApprovals:', error);
    return { leaves: [], wfh: [] };
  }
}

export async function updateLeaveStatus(id: string, status: 'Approved' | 'Rejected') {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // 1. Get request details first for email and balance
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !request) throw new Error('Request not found');

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

  // 2. Update Status atomically only if it is still Pending
  const { data: updatedRequest, error } = await supabaseAdmin
    .from('leave_requests')
    .update({ status })
    .eq('id', id)
    .eq('status', 'Pending')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Database update error:', error);
    throw new Error('Database update failed');
  }

  // If no row was updated, it means another request processed it first
  if (!updatedRequest) {
    return { success: false, error: 'Leave request has already been processed.' };
  }

  // 3. Deduct Balance if Approved
  if (status === 'Approved') {
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    const days = calculateWorkingDays(start, end);
    const requestYear = start.getFullYear();
    const requestMonth = start.getMonth() + 1;

    // Ensure the leave balance record exists so that the stored procedure UPDATE can match and increment it.
    const { data: existingBalance } = await supabaseAdmin
      .from('leave_balances')
      .select('id')
      .eq('employee_id', request.employee_id)
      .eq('year', requestYear)
      .eq('month', requestMonth)
      .eq('leave_type', request.type)
      .maybeSingle();

    if (!existingBalance) {
      const { error: initError } = await supabaseAdmin
        .from('leave_balances')
        .insert([{
          employee_id: request.employee_id,
          leave_type: request.type,
          total_days: request.type === 'Casual' ? 1 : 0,
          used_days: 0,
          year: requestYear,
          month: requestMonth
        }]);
      if (initError) {
        console.error('Failed to initialize leave balance during approval:', initError.message);
        // Revert status update
        await supabaseAdmin
          .from('leave_requests')
          .update({ status: 'Pending' })
          .eq('id', id);
        throw new Error(`Failed to initialize leave balance row: ${initError.message}`);
      }
    }

    // Atomic update to used_days via stored procedure to prevent race conditions
    const { error: rpcError } = await supabaseAdmin.rpc('increment_used_days', {
      p_employee_id: request.employee_id,
      p_leave_type: request.type,
      p_days: days,
      p_year: requestYear,
      p_month: requestMonth
    });

    if (rpcError) {
      console.error('RPC increment_used_days failed:', rpcError.message);
      // Revert the status update for consistency
      await supabaseAdmin
        .from('leave_requests')
        .update({ status: 'Pending' })
        .eq('id', id);
      throw new Error(`Failed to update leave balance atomically: ${rpcError.message}`);
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
    await sendNotificationEmail(employee.email, `Leave Request ${status}`, html);
  }

  revalidatePath('/admin/approvals');
  revalidatePath('/employee/leaves');
  return { success: true };
}

export async function updateWFHStatus(id: string, status: 'Approved WFH' | 'Rejected WFH') {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // 1. Get request details
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !request) throw new Error('Request not found');

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

  // 2. Fetch the last sequence number for the session's event stream
  const { data: lastEvent } = await supabaseAdmin
    .from('attendance_events')
    .select('sequence_number')
    .eq('session_id', id)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastEvent?.sequence_number || 1) + 1;

  // Insert ADMIN_OVERRIDE event instead of direct mutation
  const { error: insertError } = await supabaseAdmin
    .from('attendance_events')
    .insert([{
      session_id: id,
      employee_id: request.employee_id,
      event_type: 'ADMIN_OVERRIDE',
      sequence_number: nextSequence,
      idempotency_key: `override-${id}-status-${status}-${nextSequence}`,
      client_ip: '0.0.0.0', // Admin action
      payload: {
        override_field: 'status',
        old_value: request.status,
        new_value: status,
        reason: `WFH request approval decision to ${status}`,
        admin_id: session.id
      }
    }]);

  if (insertError) {
    console.error('Error logging WFH approval override event:', insertError);
    throw new Error('Database transaction failed to append WFH override');
  }

  // Trigger projection rebuild to apply the WFH override status change
  const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
    p_session_id: id
  });

  if (rebuildError) {
    console.error('Error rebuilding projection in updateWFHStatus:', rebuildError);
    throw new Error('Database projection rebuild failed');
  }

  // Recalculate employee lates for the month of this record
  if (request.date) {
    const recordDate = new Date(request.date);
    const year = recordDate.getFullYear();
    const month = recordDate.getMonth() + 1;
    const { error: rpcError } = await supabaseAdmin.rpc('recalculate_employee_lates_safe', {
      p_employee_id: request.employee_id,
      p_year: year,
      p_month: month
    });
    if (rpcError) {
      console.error('Error running recalculate_employee_lates_safe in updateWFHStatus:', rpcError);
    }
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
    await sendNotificationEmail(employee.email, `WFH Request ${status.includes('Approved') ? 'Approved' : 'Rejected'}`, html);
  }

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/attendance');
  revalidatePath('/employee/attendance');
  return { success: true };
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
  if (!session || session.role !== 'admin') return [];

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
  if (!session || session.role !== 'admin') {
    return 0;
  }

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

    return (leavesCount.count || 0) + (wfhCount.count || 0) + (disputesCount.count || 0);
  } catch (err) {
    console.error('Error fetching pending counts:', err);
    return 0;
  }
}

export async function getPendingDisputes() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return [];

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
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  if (!justification || justification.trim() === '') {
    throw new Error('A justification is required to resolve a dispute.');
  }

  // 1. Get dispute details
  const { data: dispute, error: fetchError } = await supabaseAdmin
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (fetchError || !dispute) throw new Error('Dispute not found');

  if (dispute.status !== 'PENDING') {
    throw new Error('Dispute has already been resolved.');
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
      throw new Error('Failed to append override event for dispute approval');
    }

    const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: dispute.attendance_id
    });
    if (rebuildError) {
      console.error('Error rebuilding projection in resolveDispute:', rebuildError);
      throw new Error('Projection rebuild failed');
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
    throw new Error('Failed to update dispute resolution status');
  }

  // 4. Log Audit
  await logAuditAction(
    status === 'APPROVED' ? 'APPROVE_DISPUTE' : 'REJECT_DISPUTE',
    'disputes',
    disputeId,
    { status: 'PENDING' },
    { status, justification }
  );

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/attendance');
  revalidatePath('/employee/attendance');

  return { success: true };
}
