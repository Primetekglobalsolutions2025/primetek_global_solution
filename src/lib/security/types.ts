/**
 * Attendance Trust Engine — Shared Types
 * 
 * Type definitions for the security/trust subsystem.
 * Used across network-trust, device-trust, session-tracker, and risk-engine.
 */

// ── Risk Levels ──────────────────────────────────────────────
export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskSignal {
  signal: string;
  weight: number;
  detail: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;          // 0–100
  reasons: RiskSignal[];
  isOfficeNetwork: boolean;
  isKnownDevice: boolean;
  riskEventId?: string;
}

// ── Session ──────────────────────────────────────────────────
export interface ActiveSession {
  id: string;
  user_id: string;
  user_role: string;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  created_at: string;
  last_active: string;
  expires_at: string;
  is_valid: boolean;
}

// ── Device ───────────────────────────────────────────────────
export interface TrustedDevice {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_label: string | null;
  user_agent: string | null;
  first_seen: string;
  last_used: string;
  is_trusted: boolean;
}

// ── Risk Event (DB row) ─────────────────────────────────────
export interface AttendanceRiskEvent {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  action: 'check_in' | 'check_out' | 'wfh_request';
  risk_level: RiskLevel;
  risk_score: number;
  risk_reasons: RiskSignal[];
  ip_address: string | null;
  is_office_network: boolean;
  device_fingerprint: string | null;
  is_known_device: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Request Context (gathered per attendance action) ─────────
export interface AttendanceRequestContext {
  userId: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  latitude?: number;
  longitude?: number;
  action: 'check_in' | 'check_out' | 'wfh_request';
}
