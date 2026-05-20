'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
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

    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .in('id', allEmpIds);

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
        employee_email: empMap[w.employee_id]?.email
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

  // Fetch employee details separately for email notifications
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name, email')
    .eq('id', request.employee_id)
    .single();

  // 2. Update Status
  const { error } = await supabaseAdmin
    .from('leave_requests')
    .update({ status }) // Removed approved_by as it may not exist in the schema
    .eq('id', id);

  if (error) {
    console.error('Database update error:', error);
    throw new Error('Database update failed');
  }

  // 3. Deduct Balance if Approved
  if (status === 'Approved') {
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Use RPC or direct update to used_days
    // Fetch current balance
    const { data: balance } = await supabaseAdmin
      .from('leave_balances')
      .select('total_days, used_days')
      .eq('employee_id', request.employee_id)
      .eq('leave_type', request.type)
      .single();

    if (balance) {
      const newUsed = (balance.used_days || 0) + days;
      const newRemaining = (balance.total_days || 0) - newUsed;
      
      await supabaseAdmin
        .from('leave_balances')
        .update({ 
          used_days: newUsed
        })
        .eq('employee_id', request.employee_id)
        .eq('leave_type', request.type);
    }
    
    // Note: In Supabase, we should ideally use a stored procedure to increment safely
    // For now, we'll fetch current used_days if we want to be safer, but let's assume single admin for now.
  }

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

  // Fetch employee details separately
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name, email')
    .eq('id', request.employee_id)
    .single();

  // 2. Update Status
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ status })
    .eq('id', id);

  if (error) throw error;

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
