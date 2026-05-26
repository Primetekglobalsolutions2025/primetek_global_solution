'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function applyForLeave(formData: {
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
}) {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  // 1. Enforce allowed leave types
  if (!['Casual', 'Unpaid'].includes(formData.type)) {
    throw new Error('Only Casual Leave and Unpaid Leave requests are supported.');
  }

  const start = new Date(formData.start_date);
  const end = new Date(formData.end_date);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (days < 1) {
    throw new Error('Invalid leave duration.');
  }

  // 2. Limit Casual Leave to exactly 1 day per request
  if (formData.type === 'Casual' && days !== 1) {
    throw new Error('Casual Leave can only be requested in 1-day increments.');
  }

  // 3. Block requests falling on weekends (Saturday or Sunday)
  const dayOfWeek = start.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new Error('Leave requests cannot fall on weekends (Saturday or Sunday).');
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
      throw new Error('You have already requested or taken Casual Leave in this calendar month.');
    }
  }

  // 5. Check for overlapping requests on the exact date
  const { data: overlaps, error: overlapError } = await supabaseAdmin
    .from('leave_requests')
    .select('id')
    .eq('employee_id', session.id)
    .in('status', ['Pending', 'Approved'])
    .eq('start_date', formData.start_date);

  if (overlapError) throw overlapError;
  if (overlaps && overlaps.length > 0) {
    throw new Error('You have an overlapping leave request for this date.');
  }

  // 6. Record request
  const { error } = await supabaseAdmin
    .from('leave_requests')
    .insert([{
      employee_id: session.id,
      type: formData.type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason,
      status: 'Pending'
    }]);

  if (error) throw error;

  revalidatePath('/employee/leaves');
  return { success: true };
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
    const defaultCL = 1;

    const defaults = [
      { 
        employee_id: session.id, 
        leave_type: 'Casual', 
        total_days: defaultCL, 
        used_days: 0,
        year: currentYear,
        month: currentMonth
      },
    ];

    const { data: newData, error: initError } = await supabaseAdmin
      .from('leave_balances')
      .insert(defaults)
      .select();

    if (initError) {
      console.error('Error initializing monthly balance:', initError);
      return [];
    }
    return newData;
  }

  return data;
}
