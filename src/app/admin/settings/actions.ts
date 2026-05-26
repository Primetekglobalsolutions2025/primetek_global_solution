'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';

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

  // Fetch the active office location before updates for audit trail comparison
  const { data: oldLocations } = await supabaseAdmin
    .from('office_locations')
    .select('*')
    .eq('is_active', true);
  const oldLocation = oldLocations && oldLocations.length > 0 ? oldLocations[0] : null;

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

  if (insertedData && insertedData.length > 0) {
    await logAuditAction(
      'UPDATE_OFFICE_LOCATION',
      'office_locations',
      insertedData[0].id,
      oldLocation,
      insertedData[0]
    );
  }

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
