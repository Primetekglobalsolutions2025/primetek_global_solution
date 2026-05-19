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
