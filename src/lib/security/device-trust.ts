/**
 * Device Trust Tracker
 * 
 * Manages device fingerprint associations for employees.
 * Used for anomaly detection — NOT hard identity proof.
 * 
 * If a new device appears for an employee, it's flagged as a trust signal,
 * but the action is not blocked. Admin gets visibility.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { TrustedDevice } from './types';

/**
 * Check if a device fingerprint is known for a given user.
 * Registers it as a new device if not seen before.
 * Returns: { isKnownDevice, isFirstDevice }
 */
export async function checkAndRegisterDevice(
  userId: string,
  fingerprint: string,
  userAgent: string
): Promise<{ isKnownDevice: boolean; isFirstDevice: boolean }> {
  try {
    // Look up existing device
    const { data: existing } = await supabaseAdmin
      .from('trusted_devices')
      .select('id, is_trusted')
      .eq('user_id', userId)
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    if (existing) {
      // Update last_used timestamp
      await supabaseAdmin
        .from('trusted_devices')
        .update({ last_used: new Date().toISOString() })
        .eq('id', existing.id);

      return { isKnownDevice: true, isFirstDevice: false };
    }

    // Check if user has ANY registered devices
    const { count } = await supabaseAdmin
      .from('trusted_devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const isFirstDevice = (count ?? 0) === 0;

    // Register new device
    await supabaseAdmin.from('trusted_devices').insert({
      user_id: userId,
      device_fingerprint: fingerprint,
      user_agent: userAgent.slice(0, 512), // cap length
      device_label: buildDeviceLabel(userAgent),
      first_seen: new Date().toISOString(),
      last_used: new Date().toISOString(),
      is_trusted: isFirstDevice, // first device auto-trusted; subsequent ones need review
    });

    return { isKnownDevice: false, isFirstDevice };
  } catch (err) {
    console.error('[DeviceTrust] Error checking device:', err);
    // Fail open — don't block on DB errors
    return { isKnownDevice: true, isFirstDevice: false };
  }
}

/**
 * Get all trusted devices for a user (for admin display).
 */
export async function getUserDevices(userId: string): Promise<TrustedDevice[]> {
  const { data } = await supabaseAdmin
    .from('trusted_devices')
    .select('*')
    .eq('user_id', userId)
    .order('last_used', { ascending: false });

  return (data as TrustedDevice[]) || [];
}

/**
 * Build a human-readable device label from user agent string.
 */
function buildDeviceLabel(userAgent: string): string {
  if (!userAgent) return 'Unknown Device';

  const ua = userAgent.toLowerCase();

  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = 'Unknown Browser';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';

  return `${browser} on ${os}`;
}
