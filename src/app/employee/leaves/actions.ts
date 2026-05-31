'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export async function applyForLeave(formData: {
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
}) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveSession(session.id);

    // 1. Enforce allowed leave types
    if (!['Casual', 'Unpaid'].includes(formData.type)) {
      return { success: false, error: 'Only Casual Leave and Unpaid Leave requests are supported.' };
    }

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days < 1) {
      return { success: false, error: 'Invalid leave duration.' };
    }

    // 2. Limit Casual Leave to exactly 1 day per request
    if (formData.type === 'Casual' && days !== 1) {
      return { success: false, error: 'Casual Leave can only be requested in 1-day increments.' };
    }

    // 3. Block requests falling on weekends (Saturday or Sunday)
    const dayOfWeek = start.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { success: false, error: 'Leave requests cannot fall on weekends (Saturday or Sunday).' };
    }

    const startMonth = start.getMonth() + 1;
    const startYear = start.getFullYear();

    // 4. Verify employee does not exceed 1 CL/month limit
    if (formData.type === 'Casual') {
      const startOfMonthStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
      const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
      const nextMonthYear = startMonth === 12 ? startYear + 1 : startYear;
      const endOfMonthStr = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const { data: existingRequests, error: reqError } = await supabaseAdmin
        .from('leave_requests')
        .select('id')
        .eq('employee_id', session.id)
        .eq('type', 'Casual')
        .in('status', ['Pending', 'Approved'])
        .gte('start_date', startOfMonthStr)
        .lt('start_date', endOfMonthStr);

      if (reqError) throw reqError;
      if (existingRequests && existingRequests.length > 0) {
        return { success: false, error: 'You have already requested or taken Casual Leave in this calendar month.' };
      }
    }

    // 5. Check for overlapping requests within the date range
    const { data: overlaps, error: overlapError } = await supabaseAdmin
      .from('leave_requests')
      .select('id')
      .eq('employee_id', session.id)
      .in('status', ['Pending', 'Approved'])
      .gte('end_date', formData.start_date)
      .lte('start_date', formData.end_date);

    if (overlapError) throw overlapError;
    if (overlaps && overlaps.length > 0) {
      return { success: false, error: 'You have an overlapping leave request for this date range.' };
    }

    // 6. Record request
    const { error, data: newLeave } = await supabaseAdmin
      .from('leave_requests')
      .insert([{
        employee_id: session.id,
        type: formData.type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        status: 'Pending'
      }])
      .select('id')
      .single();

    if (error) throw error;

    // Trigger notification to admin
    try {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('id', session.id)
        .single();
      const employeeName = employee?.name || 'An employee';

      const { getAdminLeaveRequestTemplate, notifyAdminsIfEnabled } = await import('@/lib/notifications');
      const html = getAdminLeaveRequestTemplate(
        employeeName,
        formData.type,
        formData.start_date,
        formData.end_date,
        formData.reason
      );
      const emailResult = await notifyAdminsIfEnabled('notif_leave', `New Leave Request - ${employeeName}`, html);
      if (emailResult) {
        const resultAsAny = emailResult as any;
        if (!resultAsAny.success) {
          console.warn(`[Email Delivery Failed] action: applyForLeave, error: ${resultAsAny.error || resultAsAny.reason}`);
          await logAuditAction('EMAIL_DELIVERY_FAILED', 'leave_requests', newLeave?.id, null, {
            recipient: 'admin',
            subject: `New Leave Request - ${employeeName}`,
            error: resultAsAny.error || resultAsAny.reason
          });
        } else if (resultAsAny.results) {
          for (const r of resultAsAny.results) {
            const rAsAny = r as any;
            if (!rAsAny.success) {
              console.warn(`[Email Delivery Failed] action: applyForLeave, error: ${rAsAny.error}`);
              await logAuditAction('EMAIL_DELIVERY_FAILED', 'leave_requests', newLeave?.id, null, {
                recipient: 'admin',
                subject: `New Leave Request - ${employeeName}`,
                error: rAsAny.error
              });
            }
          }
        }
      }

      // Web Push notification to admins
      try {
        const { data: admins } = await supabaseAdmin.from('admin_users').select('id');
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await dispatchNotification({
              title: `New Leave Request`,
              message: `${employeeName} requested ${formData.type} leave from ${formData.start_date} to ${formData.end_date}.`,
              type: 'leave_approval_required',
              adminId: admin.id,
              clickActionUrl: '/admin/approvals'
            });
          }
        }
      } catch (pushErr: any) {
        console.warn(`[Push Delivery Failed] action: applyForLeave, error: ${pushErr.message}`);
      }
    } catch (notifErr) {
      console.error('Failed to send leave notification:', notifErr);
      await logAuditAction('EMAIL_DELIVERY_FAILED', 'leave_requests', newLeave?.id, null, {
        recipient: 'admin',
        subject: 'New Leave Request (Error)',
        error: notifErr instanceof Error ? notifErr.message : String(notifErr)
      });
    }

    revalidatePath('/employee/leaves');
    return { success: true };
  } catch (err: any) {
    console.error('Error applying for leave:', err);
    return { success: false, error: err.message || 'Failed to submit leave request' };
  }
}

export async function getEmployeeLeaves() {
  const session = await getSession();
  if (!session || !session.id) return [];

  const { data, error } = await supabaseAdmin
    .from('leave_requests')
    .select('*')
    .eq('employee_id', session.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leaves:', error);
    return [];
  }

  return data;
}

export async function getLeaveBalances() {
  const session = await getSession();
  if (!session || !session.id) return [];

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Fetch balance for the current month
  const { data, error } = await supabaseAdmin
    .from('leave_balances')
    .select('*')
    .eq('employee_id', session.id)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .eq('leave_type', 'Casual');

  if (error) {
    console.error('Error fetching balances:', error);
    return [];
  }

  // Initialize balance for current month if missing (default is 1 day, does not carry forward)
  if (data.length === 0) {
    return [
      { 
        employee_id: session.id, 
        leave_type: 'Casual', 
        total_days: 1, 
        used_days: 0,
        year: currentYear,
        month: currentMonth
      },
    ];
  }

  return data;
}

async function initializeLeaveBalance(employeeId: string, year: number, month: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    await verifyActiveSession(session.id);
    if (employeeId !== session.id) {
      throw new Error('Unauthorized: employeeId mismatch');
    }

    const { data: existing } = await supabaseAdmin
      .from('leave_balances')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .eq('month', month)
      .eq('leave_type', 'Casual')
      .maybeSingle();

    if (!existing) {
      const defaults = { 
        employee_id: employeeId, 
        leave_type: 'Casual', 
        total_days: 1, 
        used_days: 0,
        year,
        month
      };

      const { data, error } = await supabaseAdmin
        .from('leave_balances')
        .insert([defaults])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, balance: data };
    }
    return { success: true, message: 'Already initialized' };
  } catch (err) {
    console.error('Error initializing leave balance:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Initialization failed' };
  }
}
