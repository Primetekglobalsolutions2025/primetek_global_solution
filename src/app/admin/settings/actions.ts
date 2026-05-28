'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';

export async function getOfficeLocation() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

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
  await verifyActiveAdmin(session.id);

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
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);
 
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

export async function getNotificationPreferences() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  const { data, error } = await supabaseAdmin
    .from('portal_config')
    .select('config_key, config_value')
    .in('config_key', ['notif_leave', 'notif_wfh', 'notif_inquiry', 'notif_digest', 'notif_audio']);

  const prefs = {
    notifLeave: true,
    notifWFH: true,
    notifInquiry: true,
    notifDigest: false,
    audioAlerts: true
  };

  if (error || !data) {
    console.error('Error fetching notification preferences:', error);
    return prefs;
  }

  data.forEach((row) => {
    if (row.config_key === 'notif_leave') prefs.notifLeave = row.config_value !== 'false';
    if (row.config_key === 'notif_wfh') prefs.notifWFH = row.config_value !== 'false';
    if (row.config_key === 'notif_inquiry') prefs.notifInquiry = row.config_value !== 'false';
    if (row.config_key === 'notif_digest') prefs.notifDigest = row.config_value === 'true';
    if (row.config_key === 'notif_audio') prefs.audioAlerts = row.config_value !== 'false';
  });

  return prefs;
}

export async function saveNotificationPreferences(prefs: {
  notifLeave: boolean;
  notifWFH: boolean;
  notifInquiry: boolean;
  notifDigest: boolean;
  audioAlerts: boolean;
}) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  const { error } = await supabaseAdmin
    .from('portal_config')
    .upsert([
      { config_key: 'notif_leave', config_value: String(prefs.notifLeave), description: 'Email alerts for leave requests' },
      { config_key: 'notif_wfh', config_value: String(prefs.notifWFH), description: 'Email alerts for WFH check-ins' },
      { config_key: 'notif_inquiry', config_value: String(prefs.notifInquiry), description: 'Email alerts for contact inquiries' },
      { config_key: 'notif_digest', config_value: String(prefs.notifDigest), description: 'Weekly reports digest summary' },
      { config_key: 'notif_audio', config_value: String(prefs.audioAlerts), description: 'Auditory dashboard alert chimes' }
    ]);

  if (error) {
    console.error('Error saving notification preferences:', error);
    throw new Error('Failed to save preferences to database');
  }

  // Log action to audit ledger
  await logAuditAction(
    'UPDATE_NOTIFICATION_PREFERENCES',
    'portal_config',
    'notification_preferences',
    null,
    prefs
  );

  revalidatePath('/admin/settings');
  return { success: true };
}
