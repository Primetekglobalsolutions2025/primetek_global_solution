'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getOfficeLocation() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('office_locations')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching office location:', error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

export async function saveOfficeLocation(data: {
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
}) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  console.log('Attempting to save office location:', data);

  if (process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder' || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('WARNING: Using placeholder or missing SUPABASE_SERVICE_ROLE_KEY. Database operations may fail due to RLS.');
  }

  // Deactivate existing locations
  const { error: updateError } = await supabaseAdmin
    .from('office_locations')
    .update({ is_active: false })
    .eq('is_active', true);

  if (updateError) {
    console.error('Error deactivating old locations:', updateError);
  }

  // Insert new location
  const { data: insertedData, error: insertError } = await supabaseAdmin
    .from('office_locations')
    .insert([{
      name: data.name,
      lat: data.lat,
      lng: data.lng,
      radius_meters: data.radius_meters,
      is_active: true
    }])
    .select();

  if (insertError) {
    console.error('CRITICAL: Error saving office location:', insertError);
    throw new Error(`Database Error: ${insertError.message} (${insertError.code})`);
  }

  console.log('Successfully saved office location:', insertedData);

  revalidatePath('/admin/settings');
  revalidatePath('/employee/attendance');
  return { success: true };
}

export async function getSystemStatus() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');
 
  const { data, error } = await supabaseAdmin
    .from('system_status')
    .select('*')
    .order('node_name');

  if (error) {
    console.error('Error fetching system status:', error);
    return [];
  }
  return data;
}

export async function getCasualLeaveConfig() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('portal_config')
    .select('config_value')
    .eq('config_key', 'default_casual_leave')
    .maybeSingle();

  if (error) {
    console.error('Error fetching casual leave config:', error);
    return 1;
  }
  return data ? parseInt(data.config_value) : 1;
}

export async function saveAndApplyCasualLeavePolicy(value: number) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // 1. Update config
  const { error: configError } = await supabaseAdmin
    .from('portal_config')
    .upsert({ config_key: 'default_casual_leave', config_value: String(value) }, { onConflict: 'config_key' });

  if (configError) {
    console.error('Error saving config:', configError);
    throw new Error('Failed to update system config');
  }

  // 2. Fetch all active employees
  const { data: employees, error: empError } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('status', 'Active');

  if (empError) {
    console.error('Error fetching active employees:', empError);
    throw new Error('Failed to retrieve active employees');
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 3. Bulk upsert balances for all active employees for current month to avoid N+1 query issue (PERF-02)
  const empIds = employees.map(e => e.id);
  const { data: existingBalances, error: balError } = await supabaseAdmin
    .from('leave_balances')
    .select('id, employee_id, used_days')
    .in('employee_id', empIds)
    .eq('leave_type', 'Casual')
    .eq('year', currentYear)
    .eq('month', currentMonth);

  if (balError) {
    console.error('Error fetching existing balances for bulk update:', balError);
    throw new Error('Failed to fetch existing balances');
  }

  const existingMap = new Map(existingBalances?.map(b => [b.employee_id, b]) || []);

  const upsertData = employees.map(emp => {
    const existing = existingMap.get(emp.id);
    return {
      ...(existing?.id ? { id: existing.id } : {}),
      employee_id: emp.id,
      leave_type: 'Casual',
      total_days: value,
      used_days: existing?.used_days || 0,
      year: currentYear,
      month: currentMonth
    };
  });

  if (upsertData.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('leave_balances')
      .upsert(upsertData, { onConflict: 'employee_id,leave_type,year,month' });

    if (upsertError) {
      console.error('Error in bulk upserting leave balances:', upsertError);
      throw new Error('Failed to bulk apply leave policy');
    }
  }


  revalidatePath('/admin/settings');
  revalidatePath('/admin/employees');
  revalidatePath('/employee/leaves');
  return { success: true };
}

