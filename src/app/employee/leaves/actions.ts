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

  const { data, error } = await supabaseAdmin
    .from('leave_balances')
    .select('*')
    .eq('employee_id', session.id);

  if (error) {
    console.error('Error fetching balances:', error);
    return [];
  }

  // If no balances exist, initialize them with defaults from portal_config
  if (data.length === 0) {
    const { data: config } = await supabaseAdmin.from('portal_config').select('*');
    const configMap = (config || []).reduce((acc: any, curr: any) => {
      acc[curr.config_key] = curr.config_value;
      return acc;
    }, {});

    const sick = parseInt(configMap['default_sick_leave'] || '12');
    const casual = parseInt(configMap['default_casual_leave'] || '10');
    const earned = parseInt(configMap['default_earned_leave'] || '15');

    const defaults = [
      { employee_id: session.id, leave_type: 'Sick', total_days: sick, used_days: 0 },
      { employee_id: session.id, leave_type: 'Casual', total_days: casual, used_days: 0 },
      { employee_id: session.id, leave_type: 'Earned', total_days: earned, used_days: 0 },
    ];

    const { data: newData, error: initError } = await supabaseAdmin
      .from('leave_balances')
      .insert(defaults)
      .select();

    if (initError) {
      console.error('Error initializing balances:', initError);
      return [];
    }
    return newData;
  }

  return data;
}
