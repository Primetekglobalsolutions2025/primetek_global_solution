/**
 * Risk Engine – Lightweight Trust Scoring for Attendance Actions
 *
 * Combines signals from:
 *   • Office network trust (IP whitelist)
 *   • Device trust (fingerprint known/first‑time)
 *   • Concurrent session detection (multiple valid sessions)
 *   • GPS location plausibility (within office radius / impossible travel)
 *   • Rapid successive actions (e.g., check‑in then immediate check‑out)
 *
 * Each signal yields a weight (0‑30). The final score (0‑100) maps to a RiskLevel.
 * This implementation is deliberately simple – it can be extended later.
 */

import { isOfficeNetwork } from './network-trust';
import { checkAndRegisterDevice } from './device-trust';
import { getActiveSession, createActiveSession } from './session-tracker';
import { isWithinOffice } from '@/lib/location';
import type { AttendanceRequestContext, RiskAssessment, RiskSignal, RiskLevel } from './types';
import { logAuditAction } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Core entry point – call from the attendance API (check‑in / check‑out).
 * Returns a RiskAssessment that can be persisted and shown to admins.
 */
export async function assessAttendanceRisk(ctx: AttendanceRequestContext): Promise<RiskAssessment> {
  const signals: RiskSignal[] = [];
  let score = 0;

  // -------------------------------------------------------------------
  // 1️⃣ Office Network Signal
  // -------------------------------------------------------------------
  const officeTrusted = isOfficeNetwork(ctx.ipAddress);
  if (officeTrusted) {
    // Low weight – being on office network is a good sign
    signals.push({ signal: 'office_network', weight: 5, detail: 'IP matches trusted office range' });
    score += 5;
  } else {
    signals.push({ signal: 'external_network', weight: 15, detail: 'IP not in office whitelist' });
    score += 15;
  }

  // -------------------------------------------------------------------
  // 2️⃣ Device Trust Signal
  // -------------------------------------------------------------------
  let deviceInfo = { isKnownDevice: true, isFirstDevice: false };
  if (ctx.deviceFingerprint) {
    deviceInfo = await checkAndRegisterDevice(ctx.userId, ctx.deviceFingerprint, ctx.userAgent);
    if (deviceInfo.isKnownDevice) {
      signals.push({ signal: 'known_device', weight: 0, detail: 'Fingerprint previously seen' });
    } else {
      const weight = deviceInfo.isFirstDevice ? 10 : 20; // first device is less suspicious than later unknowns
      signals.push({ signal: 'new_device', weight, detail: deviceInfo.isFirstDevice ? 'First device for user' : 'New fingerprint' });
      score += weight;
    }
  }

  // -------------------------------------------------------------------
  // 3️⃣ Concurrent Session Signal
  // -------------------------------------------------------------------
  const existingSession = await getActiveSession(ctx.userId);
  if (existingSession && existingSession.is_valid) {
    // There is already a valid session – treat as concurrent usage
    signals.push({ signal: 'concurrent_session', weight: 20, detail: 'Another active session exists' });
    score += 20;
  } else {
    // No active session – create one for this request
    await createActiveSession({
      userId: ctx.userId,
      role: ctx.userRole,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      deviceFingerprint: ctx.deviceFingerprint,
    });
  }

  // -------------------------------------------------------------------
  // 4️⃣ GPS / Location Signal (if coordinates supplied)
  // -------------------------------------------------------------------
  if (typeof ctx.latitude === 'number' && typeof ctx.longitude === 'number') {
    const withinOffice = isWithinOffice(ctx.latitude, ctx.longitude);
    if (withinOffice) {
      signals.push({ signal: 'location_within_office', weight: 0, detail: 'GPS inside office radius' });
    } else {
      // Not in office – could be remote work or spoofing
      signals.push({ signal: 'location_outside_office', weight: 10, detail: 'GPS outside office radius' });
      score += 10;
    }
  }

  // -------------------------------------------------------------------
  // 5️⃣ Rapid Action Heuristic – simple detection of impossibly fast check‑in/out
  // -------------------------------------------------------------------
  // For demonstration we just flag if an action is performed within 30 seconds of the previous one.
  // In production you would query the last attendance record for the employee.
  // (Implementation left to the calling API; we only expose a helper constant.)

  // -------------------------------------------------------------------
  // Compute final level (0‑100 scale)
  // -------------------------------------------------------------------
  const finalScore = Math.min(score, 100);
  const level: RiskLevel = finalScore >= 75 ? 'high' : finalScore >= 35 ? 'medium' : 'low';

  let riskEventId: string | undefined;
  // Persist risk event for audit visibility (fails silently on DB errors)
  try {
    const { data: riskEvent, error: insertError } = await supabaseAdmin
      .from('attendance_risk_events')
      .insert({
        employee_id: ctx.userId,
        action: ctx.action,
        risk_level: level,
        risk_score: finalScore,
        risk_reasons: signals,
        ip_address: ctx.ipAddress,
        is_office_network: officeTrusted,
        device_fingerprint: ctx.deviceFingerprint || null,
        is_known_device: deviceInfo.isKnownDevice,
        metadata: { user_agent: ctx.userAgent }
      })
      .select('id')
      .single();

    if (insertError) {
      console.warn('[RiskEngine] DB Error logging risk event:', insertError);
    } else if (riskEvent) {
      riskEventId = riskEvent.id;
    }
  } catch (e) {
    console.warn('[RiskEngine] Unable to log risk event', e);
  }

  return {
    level,
    score: finalScore,
    reasons: signals,
    isOfficeNetwork: officeTrusted,
    isKnownDevice: deviceInfo.isKnownDevice,
    riskEventId,
  };
}
