'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
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

export async function saveOfficeLocation(
  data: {
    name: string;
    lat: number;
    lng: number;
    radius_meters: number;
  },
  password?: string
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    // Fetch the active office location before updates for audit trail comparison
    const { data: oldLocations } = await supabaseAdmin
      .from('office_locations')
      .select('*')
      .eq('is_active', true);
    const oldLocation = oldLocations && oldLocations.length > 0 ? oldLocations[0] : null;

    const coordsChanged = oldLocation 
      ? (oldLocation.lat !== data.lat || oldLocation.lng !== data.lng)
      : true;

    if (coordsChanged) {
      if (!password) {
        return { success: false, error: 'Password is required to change geofence coordinates.' };
      }

      const { createClient } = await import('@supabase/supabase-js');
      const { env } = await import('@/lib/env');

      const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { error: authError } = await authClient.auth.signInWithPassword({
        email: session.email,
        password: password,
      });

      if (authError) {
        return { success: false, error: 'Invalid admin password. Authorization failed.' };
      }
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
      return { success: false, error: `Database Error: ${insertError.message}` };
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
    (revalidateTag as any)('office-location');
    return { success: true };
  } catch (err: any) {
    console.error('saveOfficeLocation crashed:', err);
    return { success: false, error: err.message || 'Failed to save office location' };
  }
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
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
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
      return { success: false, error: 'Failed to save preferences to database' };
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
    (revalidateTag as any)('portal-config');
    return { success: true };
  } catch (err: any) {
    console.error('saveNotificationPreferences crashed:', err);
    return { success: false, error: err.message || 'Failed to save notification preferences' };
  }
}
