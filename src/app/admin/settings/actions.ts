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

/**
 * Unlock a blocked employee account by clearing their rate limit record.
 * Use this when an employee is locked out due to too many failed login attempts.
 */
export async function unlockEmployeeAccount(email: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  if (!email || !email.includes('@')) {
    return { success: false, error: 'Invalid email address' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const accountKey = `login:account:${cleanEmail}`;

  const { error } = await supabaseAdmin
    .from('rate_limits')
    .delete()
    .eq('key', accountKey);

  if (error) {
    console.error('[unlockEmployeeAccount] Error clearing rate limit:', error);
    return { success: false, error: 'Failed to unlock account' };
  }

  await logAuditAction(
    'UNLOCK_EMPLOYEE_ACCOUNT',
    'rate_limits',
    undefined,
    null,
    { email: cleanEmail, unlockedBy: session.id }
  );

  revalidatePath('/admin/settings');
  return { success: true };
}

export async function getOfficeIPs() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  const { data, error } = await supabaseAdmin
    .from('portal_config')
    .select('config_value')
    .eq('config_key', 'office_ip_whitelist')
    .maybeSingle();

  if (error) {
    console.error('Error fetching office IP whitelist:', error);
    return '49.205.253.45'; // Default fallback
  }

  return data?.config_value || '49.205.253.45';
}

export async function saveOfficeIPs(ips: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Unauthorized' };
    await verifyActiveAdmin(session.id);

    // Normalize and clean up input IPs
    const cleanedIps = ips
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
      .join(',');

    const { error } = await supabaseAdmin
      .from('portal_config')
      .upsert({
        config_key: 'office_ip_whitelist',
        config_value: cleanedIps,
        description: 'Comma-separated whitelisted office IP addresses or CIDR blocks'
      });

    if (error) {
      console.error('Error saving office IP whitelist:', error);
      return { success: false, error: 'Failed to save office IP whitelist' };
    }

    await logAuditAction(
      'UPDATE_OFFICE_IP_WHITELIST',
      'portal_config',
      'office_ip_whitelist',
      null,
      { office_ip_whitelist: cleanedIps }
    );

    revalidatePath('/admin/settings');
    if (typeof revalidateTag === 'function') {
      (revalidateTag as any)('portal-config');
    }
    return { success: true };
  } catch (err: any) {
    console.error('saveOfficeIPs crashed:', err);
    return { success: false, error: err.message || 'Failed to save office IP whitelist' };
  }
}

export async function getBlockedEntities() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  const nowIso = new Date().toISOString();

  // Query rate_limits table where points <= 0 and expire_at > now
  const { data: limits, error } = await supabaseAdmin
    .from('rate_limits')
    .select('key, points, expire_at')
    .lte('points', 0)
    .gt('expire_at', nowIso);

  if (error) {
    console.error('Error fetching blocked entities:', error);
    return [];
  }

  if (!limits || limits.length === 0) {
    return [];
  }

  // Fetch employees and admins to resolve UUID keys
  const [{ data: employees }, { data: admins }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, name, email'),
    supabaseAdmin.from('admin_users').select('id, email')
  ]);

  const employeeMap = new Map<string, { name: string; email: string }>();
  if (employees) {
    employees.forEach(emp => {
      employeeMap.set(emp.id, { name: emp.name, email: emp.email });
    });
  }

  const adminMap = new Map<string, string>();
  if (admins) {
    admins.forEach(adm => {
      adminMap.set(adm.id, adm.email);
    });
  }

  // Parse each record
  return limits.map(record => {
    const key = record.key;
    let type: 'ip' | 'mfa_ip' | 'account' | 'mfa_account' = 'ip';
    let identifier = '';
    let resolvedName = '';

    if (key.startsWith('login:ip:')) {
      type = 'ip';
      identifier = key.substring('login:ip:'.length);
    } else if (key.startsWith('login:mfa_ip:')) {
      type = 'mfa_ip';
      identifier = key.substring('login:mfa_ip:'.length);
    } else if (key.startsWith('login:account:')) {
      type = 'account';
      identifier = key.substring('login:account:'.length);
    } else if (key.startsWith('login:mfa_account:')) {
      type = 'mfa_account';
      const userId = key.substring('login:mfa_account:'.length);
      identifier = userId;
      
      const emp = employeeMap.get(userId);
      if (emp) {
        resolvedName = `${emp.name} (Employee)`;
        identifier = emp.email;
      } else {
        const admEmail = adminMap.get(userId);
        if (admEmail) {
          resolvedName = `Admin (${admEmail})`;
          identifier = admEmail;
        } else {
          resolvedName = 'Unknown User';
        }
      }
    } else {
      identifier = key;
    }

    return {
      key,
      type,
      identifier,
      resolvedName,
      expireAt: record.expire_at,
      points: record.points
    };
  });
}

export async function unblockEntity(key: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
    await verifyActiveAdmin(session.id);

    const { error } = await supabaseAdmin
      .from('rate_limits')
      .delete()
      .eq('key', key);

    if (error) {
      console.error('[unblockEntity] Error deleting rate limit:', error);
      return { success: false, error: 'Failed to unblock entity' };
    }

    await logAuditAction(
      'UNBLOCK_ENTITY',
      'rate_limits',
      undefined,
      null,
      { key, unblockedBy: session.id }
    );

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (err: any) {
    console.error('unblockEntity crashed:', err);
    return { success: false, error: err.message || 'Failed to unblock entity' };
  }
}

