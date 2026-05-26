-- ============================================================
-- Migration 13: Attendance Trust & Security Engine (with RLS)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Active Sessions Table
-- Tracks one active session per employee for concurrent login detection
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'employee',
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  is_valid BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id, is_valid);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at) WHERE is_valid = true;

-- Enable RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only delete (invalidate) their own sessions
CREATE POLICY "Users can delete own sessions"
  ON active_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all sessions
CREATE POLICY "Service role manages sessions"
  ON active_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================

-- 2. Trusted Devices Table
-- Associates device fingerprints with employees for anomaly detection
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT,
  user_agent TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_trusted BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fp ON trusted_devices(device_fingerprint);

-- Enable RLS
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can only see their own devices
CREATE POLICY "Users can view own devices"
  ON trusted_devices FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own devices (e.g., set is_trusted)
CREATE POLICY "Users can update own devices"
  ON trusted_devices FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage all devices
CREATE POLICY "Service role manages devices"
  ON trusted_devices FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================

-- 3. Attendance Risk Events Table
-- Logs risk signals for every attendance action (check-in, check-out)
CREATE TABLE IF NOT EXISTS attendance_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  attendance_id UUID,
  action TEXT NOT NULL,            -- 'check_in', 'check_out', 'wfh_request'
  risk_level TEXT NOT NULL,        -- 'low', 'medium', 'high'
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ip_address TEXT,
  is_office_network BOOLEAN DEFAULT false,
  device_fingerprint TEXT,
  is_known_device BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_employee ON attendance_risk_events(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_level ON attendance_risk_events(risk_level) WHERE risk_level IN ('medium', 'high');
CREATE INDEX IF NOT EXISTS idx_risk_events_date ON attendance_risk_events(created_at DESC);

-- Enable RLS
ALTER TABLE attendance_risk_events ENABLE ROW LEVEL SECURITY;

-- Employees can only view their own risk events
CREATE POLICY "Employees can view own risk events"
  ON attendance_risk_events FOR SELECT
  USING (auth.uid() = employee_id);

-- Service role can manage all risk events (for admin dashboard reads + writes)
CREATE POLICY "Service role manages risk events"
  ON attendance_risk_events FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================

-- 4. Cleanup function: expire old sessions (call via pg_cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM active_sessions
    WHERE expires_at < now() OR is_valid = false
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Cleanup function: purge old risk events (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_risk_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM attendance_risk_events
    WHERE created_at < now() - interval '90 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
