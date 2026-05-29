/**
 * Session Tracker – Active Attendance Session Management
 *
 * Guarantees only one *valid* attendance session per employee.
 * Stores IP, User‑Agent, device fingerprint and timestamps.
 * On new login the previous session is invalidated (soft‑deleted).
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ActiveSession } from './types';

/**
 * Create a new active session for a user.
 * Returns the freshly created session row.
 */
export async function createActiveSession(params: {
  userId: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
}): Promise<ActiveSession | null> {
  const { userId, role, ipAddress, userAgent, deviceFingerprint } = params;
  try {
    // Invalidate any existing sessions for this user first (soft‑delete)
    await supabaseAdmin
      .from('active_sessions')
      .update({ is_valid: false })
      .eq('user_id', userId)
      .eq('is_valid', true);

    const { data, error } = await supabaseAdmin
      .from('active_sessions')
      .insert({
        user_id: userId,
        user_role: role,
        ip_address: ipAddress,
        user_agent: userAgent.slice(0, 512),
        device_fingerprint: deviceFingerprint ?? null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7‑day TTL
        is_valid: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[SessionTracker] Insert error:', error);
      return null;
    }
    return data as ActiveSession;
  } catch (e) {
    console.error('[SessionTracker] Unexpected error:', e);
    return null;
  }
}

/**
 * Retrieve the current *valid* session for a user, if any.
 */
export async function getActiveSession(userId: string): Promise<ActiveSession | null> {
  const { data, error } = await supabaseAdmin
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .single();
  if (error) {
    // No active session – not an error condition
    return null;
  }
  return data as ActiveSession;
}

/**
 * Invalidate a session (soft delete) – used on logout or forced revocation.
 */
export async function invalidateSession(sessionId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('active_sessions')
    .update({ is_valid: false })
    .eq('id', sessionId);
  return !error;
}

/**
 * Touch the session's last_active timestamp – called on every protected request.
 */
export async function touchSession(sessionId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('active_sessions')
    .update({ last_active: new Date().toISOString() })
    .eq('id', sessionId);
  return !error;
}
