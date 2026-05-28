-- ====================================================================
-- PRIMETEK HR PORTAL — All Pending Migrations (Safe to re-run)
-- Run this entire block in Supabase SQL Editor
-- ====================================================================

-- ============================================================
-- MIGRATION 1: Attendance Break, Shift, and Leave Updates
-- ============================================================

-- 1. Update attendance status check constraint
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Map any legacy/non-standard statuses to valid values before applying constraint
UPDATE public.attendance
SET status = CASE 
    WHEN LOWER(status) IN ('working', 'active', 'active_desktop', 'desktop_active', 'desktop active', 'mobile_clocked_in', 'mobile_only') THEN 'Working'
    WHEN LOWER(status) IN ('idle', 'idle_warning') THEN 'Idle'
    WHEN LOWER(status) IN ('break', 'on break', 'active_break') THEN 'Break'
    WHEN LOWER(status) IN ('break (auto)', 'auto_break', 'productive_timer_paused', 'productive timer paused') THEN 'Break (Auto)'
    WHEN LOWER(status) IN ('logged out', 'clocked_out', 'offline', 'force_logged_out') THEN 'Logged Out'
    WHEN LOWER(status) = 'pending wfh' THEN 'Pending WFH'
    WHEN LOWER(status) = 'approved wfh' THEN 'Approved WFH'
    WHEN LOWER(status) = 'rejected wfh' THEN 'Rejected WFH'
    WHEN LOWER(status) = 'present' THEN 'Present'
    WHEN LOWER(status) = 'late' THEN 'Late'
    WHEN LOWER(status) = 'absent' THEN 'Absent'
    WHEN LOWER(status) = 'half-day' THEN 'Half-day'
    WHEN LOWER(status) = 'awaiting_desktop' THEN 'Working'
    WHEN LOWER(status) = 'geo_outside' THEN 'Break (Auto)'
    ELSE status
END;

-- Fallback: any remaining non-standard values → 'Logged Out'
UPDATE public.attendance
SET status = 'Logged Out'
WHERE status NOT IN (
    'Working', 'Idle', 'Break', 'Break (Auto)', 'Logged Out',
    'Pending WFH', 'Approved WFH', 'Rejected WFH', 
    'Present', 'Late', 'Absent', 'Half-day',
    'MOBILE_CLOCKED_IN', 'AWAITING_DESKTOP', 'DESKTOP_ACTIVE', 'PRODUCTIVE_TIMER_PAUSED'
);

ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN (
    'Working', 'Idle', 'Break', 'Break (Auto)', 'Logged Out',
    'Pending WFH', 'Approved WFH', 'Rejected WFH', 
    'Present', 'Late', 'Absent', 'Half-day',
    'MOBILE_CLOCKED_IN', 'AWAITING_DESKTOP', 'DESKTOP_ACTIVE', 'PRODUCTIVE_TIMER_PAUSED'
));

-- 2. Add break, shift, and penalty columns to public.attendance
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deduction_applied NUMERIC(3,1) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS current_break_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_break_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS productive_hours NUMERIC(4,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS late_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permission_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shift_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manager_exemption BOOLEAN DEFAULT false;

-- Create indexes for quick queries on late flags and dates
CREATE INDEX IF NOT EXISTS idx_attendance_is_late ON public.attendance(is_late);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

-- 3. Add month column to leave_balances to support monthly allocation
ALTER TABLE public.leave_balances
ADD COLUMN IF NOT EXISTS month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE);

-- Drop old unique constraint on leave_balances and add monthly unique constraint
ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_employee_id_leave_type_year_key;

ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_employee_id_leave_type_year_month_key;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_employee_id_leave_type_year_month_key
UNIQUE (employee_id, leave_type, year, month);


-- ============================================================
-- MIGRATION 2: Leave Type — Support Casual + Unpaid
-- ============================================================

-- Drop existing type checks
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;
ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

-- Add aligned constraints accepting both Casual and Unpaid types
ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_type_check
CHECK (type IN ('Casual', 'Unpaid'));

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('Casual', 'Unpaid'));


-- ============================================================
-- MIGRATION 3: Late Penalty RPC Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_all_employee_lates(p_year INTEGER, p_month INTEGER)
RETURNS VOID AS $$
DECLARE
  v_start_date DATE := to_date(p_year || '-' || lpad(p_month::text, 2, '0') || '-01', 'YYYY-MM-DD');
  v_end_date DATE := v_start_date + interval '1 month';
  
  v_emp RECORD;
  v_rec RECORD;
  v_unexempted_ids UUID[];
  v_all_ids UUID[];
  v_unexempted_count INTEGER;
BEGIN
  -- Loop over active employees
  FOR v_emp IN SELECT id FROM public.employees WHERE status = 'Active' LOOP
    v_unexempted_ids := '{}';
    v_all_ids := '{}';
    
    -- Collect all late records for this employee in the month
    FOR v_rec IN 
      SELECT id, late_approved, permission_approved, shift_override, manager_exemption, status 
      FROM public.attendance
      WHERE employee_id = v_emp.id
        AND is_late = true
        AND date >= v_start_date
        AND date < v_end_date
      ORDER BY date ASC
    LOOP
      v_all_ids := array_append(v_all_ids, v_rec.id);
      
      -- Check if unexempted
      IF NOT COALESCE(v_rec.late_approved, false)
         AND NOT COALESCE(v_rec.permission_approved, false)
         AND NOT COALESCE(v_rec.shift_override, false)
         AND NOT COALESCE(v_rec.manager_exemption, false)
         AND COALESCE(v_rec.status, '') != 'Approved WFH'
      THEN
        v_unexempted_ids := array_append(v_unexempted_ids, v_rec.id);
      END IF;
    END LOOP;
    
    -- Reset all deductions to 0 for this month
    IF array_length(v_all_ids, 1) > 0 THEN
      UPDATE public.attendance
      SET deduction_applied = 0.0
      WHERE id = ANY(v_all_ids);
    END IF;
    
    -- Apply deductions if needed
    v_unexempted_count := array_length(v_unexempted_ids, 1);
    IF v_unexempted_count >= 6 THEN
      -- Apply 0.5 to 3rd and 6th records
      UPDATE public.attendance
      SET deduction_applied = 0.5
      WHERE id = ANY(ARRAY[v_unexempted_ids[3], v_unexempted_ids[6]]);
    ELSIF v_unexempted_count >= 3 THEN
      -- Apply 0.5 to 3rd record
      UPDATE public.attendance
      SET deduction_applied = 0.5
      WHERE id = v_unexempted_ids[3];
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- MIGRATION 4: Exports Storage Bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('exports', 'exports', false) 
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- MIGRATION 5: Cleanup RPC Functions (for cron)
-- ============================================================

-- Cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
Log_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits 
  WHERE expire_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old risk events (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_risk_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.risk_assessment_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
EXCEPTION WHEN undefined_table THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- MIGRATION 6: Event-Sourcing & Materialized Projections Schema
-- ====================================================================

-- 1. Setup Custom Enum types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_event_type') THEN
        CREATE TYPE public.attendance_event_type AS ENUM (
            'CLOCK_IN',
            'BREAK_STARTED',
            'BREAK_ENDED',
            'HEARTBEAT_RECEIVED',
            'IDLE_DETECTED',
            'IDLE_WARNING_SHOWN',
            'AUTO_BREAK_TRIGGERED',
            'GPS_EXIT',
            'GPS_REENTRY',
            'GEOLOCATION_PERMISSION_REVOKED',
            'SESSION_RECOVERED',
            'CLOCK_OUT',
            'FORCE_LOGOUT',
            'ADMIN_OVERRIDE'
        );
    END IF;
END $$;

-- 2. Create partitioned Attendance Events Table
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    event_type public.attendance_event_type NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence_number INT NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    client_ip INET NOT NULL,
    gps_lat NUMERIC(10,6),
    gps_lng NUMERIC(10,6),
    gps_accuracy NUMERIC(6,2),
    device_fingerprint VARCHAR(256),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, event_timestamp)
) PARTITION BY RANGE (event_timestamp);

-- Default partition to catch any dates without specific monthly partitions
CREATE TABLE IF NOT EXISTS public.attendance_events_default 
PARTITION OF public.attendance_events DEFAULT;

-- Indexes for event replay and idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_seq ON public.attendance_events(session_id, sequence_number, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_employee_session ON public.attendance_events(employee_id, session_id, event_timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotency ON public.attendance_events(idempotency_key, event_timestamp);

-- 3. Create Projections Table (Materialized Read Model)
CREATE TABLE IF NOT EXISTS public.attendance_projections (
    session_id UUID PRIMARY KEY,
    employee_id UUID NOT NULL,
    current_state VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
    productive_seconds INT NOT NULL DEFAULT 0,
    break_seconds INT NOT NULL DEFAULT 0,
    confidence_score INT NOT NULL DEFAULT 100,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_geofence_status BOOLEAN NOT NULL DEFAULT true,
    is_stale BOOLEAN NOT NULL DEFAULT false,
    session_version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projections_employee ON public.attendance_projections(employee_id);
CREATE INDEX IF NOT EXISTS idx_projections_stale ON public.attendance_projections(is_stale) WHERE is_stale = true;

-- Enable Row Level Security
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_projections ENABLE ROW LEVEL SECURITY;

-- Policies for Attendance Events
DROP POLICY IF EXISTS "Employees can select own events" ON public.attendance_events;
CREATE POLICY "Employees can select own events" ON public.attendance_events 
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Service role manages events" ON public.attendance_events;
CREATE POLICY "Service role manages events" ON public.attendance_events 
    FOR ALL USING (auth.role() = 'service_role');

-- Policies for Attendance Projections
DROP POLICY IF EXISTS "Employees can select own projections" ON public.attendance_projections;
CREATE POLICY "Employees can select own projections" ON public.attendance_projections 
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Service role manages projections" ON public.attendance_projections;
CREATE POLICY "Service role manages projections" ON public.attendance_projections 
    FOR ALL USING (auth.role() = 'service_role');

-- 4. Create Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS public.immutable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    employee_id UUID NOT NULL,
    session_id UUID NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    confidence_score INT NOT NULL,
    telemetry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    justification_chain JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.immutable_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own audits" ON public.immutable_audit_logs;
CREATE POLICY "Employees can view own audits" ON public.immutable_audit_logs 
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Admins can view all audits" ON public.immutable_audit_logs;
CREATE POLICY "Admins can view all audits" ON public.immutable_audit_logs 
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Service role manages audits" ON public.immutable_audit_logs;
CREATE POLICY "Service role manages audits" ON public.immutable_audit_logs 
    FOR ALL USING (auth.role() = 'service_role');

-- Function to prevent modification of immutable audit logs
CREATE OR REPLACE FUNCTION public.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutable Audit logs cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON public.immutable_audit_logs;
CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON public.immutable_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_modification();

DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.immutable_audit_logs;
CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON public.immutable_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_modification();

-- 5. Heartbeat Transaction Writer Function (RPC)
CREATE OR REPLACE FUNCTION public.write_heartbeat_event(
    p_session_id UUID,
    p_employee_id UUID,
    p_event_type public.attendance_event_type,
    p_sequence INT,
    p_idempotency VARCHAR,
    p_client_ip TEXT,
    p_lat NUMERIC,
    p_lng NUMERIC,
    p_accuracy NUMERIC,
    p_status VARCHAR,
    p_payload JSONB
) RETURNS VOID AS $$
DECLARE
    v_locked_session_id UUID;
    v_last_sequence INT;
BEGIN
    SELECT id INTO v_locked_session_id
    FROM public.attendance
    WHERE id = p_session_id AND employee_id = p_employee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance session not found or access denied.';
    END IF;

    SELECT COALESCE(MAX(sequence_number), 0) INTO v_last_sequence
    FROM public.attendance_events
    WHERE session_id = p_session_id;

    IF p_sequence <= v_last_sequence THEN
        RETURN;
    END IF;

    INSERT INTO public.attendance_events (
        session_id,
        employee_id,
        event_type,
        sequence_number,
        idempotency_key,
        client_ip,
        gps_lat,
        gps_lng,
        gps_accuracy,
        payload
    ) VALUES (
        p_session_id,
        p_employee_id,
        p_event_type,
        p_sequence,
        p_idempotency,
        COALESCE(p_client_ip, '0.0.0.0')::inet,
        p_lat,
        p_lng,
        p_accuracy,
        p_payload
    );

    UPDATE public.attendance
    SET 
        status = p_status,
        last_heartbeat_at = now()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Get Session State Function (Event Replay Helper)
DROP FUNCTION IF EXISTS public.get_session_state(UUID);
CREATE OR REPLACE FUNCTION public.get_session_state(p_session_id UUID)
RETURNS TABLE (
    current_state VARCHAR,
    total_productive_seconds INT,
    total_break_seconds INT,
    last_known_gps POINT,
    is_active BOOLEAN
) AS $$
DECLARE
    r RECORD;
    v_state VARCHAR := 'OFFLINE';
    v_last_event_time TIMESTAMPTZ;
    v_prod_sec INT := 0;
    v_break_sec INT := 0;
    v_break_start TIMESTAMPTZ := NULL;
    v_work_start TIMESTAMPTZ := NULL;
    v_last_gps POINT := NULL;
BEGIN
    FOR r IN 
        SELECT event_type, event_timestamp, gps_lat, gps_lng 
        FROM public.attendance_events 
        WHERE session_id = p_session_id 
        ORDER BY sequence_number ASC 
    LOOP
        v_last_event_time := r.event_timestamp;
        IF r.gps_lat IS NOT NULL THEN
            v_last_gps := point(r.gps_lng, r.gps_lat);
        END IF;

        CASE r.event_type
            WHEN 'CLOCK_IN' THEN
                v_state := 'ACTIVE';
                v_work_start := r.event_timestamp;
            WHEN 'BREAK_STARTED', 'AUTO_BREAK_TRIGGERED' THEN
                v_state := CASE WHEN r.event_type = 'AUTO_BREAK_TRIGGERED' THEN 'AUTO_BREAK' ELSE 'ON_BREAK' END;
                v_break_start := r.event_timestamp;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;
            WHEN 'BREAK_ENDED' THEN
                v_state := 'ACTIVE';
                v_work_start := r.event_timestamp;
                IF v_break_start IS NOT NULL THEN
                    v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_break_start))::INT;
                    v_break_start := NULL;
                END IF;
            WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN
                v_state := 'CLOCKED_OUT';
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;
                IF v_break_start IS NOT NULL THEN
                    v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_break_start))::INT;
                    v_break_start := NULL;
                END IF;
            ELSE
                -- Keep current state
        END CASE;
    END LOOP;

    IF v_state = 'ACTIVE' AND v_work_start IS NOT NULL THEN
        v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (now() - v_work_start))::INT;
    ELSIF (v_state = 'ON_BREAK' OR v_state = 'AUTO_BREAK') AND v_break_start IS NOT NULL THEN
        v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (now() - v_break_start))::INT;
    END IF;

    RETURN QUERY SELECT v_state, v_prod_sec, v_break_sec, v_last_gps, (v_state != 'CLOCKED_OUT');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ====================================================================
-- MIGRATION 7: Admin Operational Hardening
-- ====================================================================

-- 1. Setup Admin Custom Types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_type') THEN
        CREATE TYPE public.admin_role_type AS ENUM ('SUPER_ADMIN', 'HR_ADMIN', 'OPERATIONS_ADMIN', 'AUDITOR_READONLY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE public.dispute_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_category') THEN
        CREATE TYPE public.dispute_category AS ENUM ('GPS_AUTO_BREAK', 'IDLE_WARNING', 'LATE_PENALTY', 'MISSING_TIME');
    END IF;
END $$;

-- 2. Add Role Column to admin_users Table
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS role public.admin_role_type NOT NULL DEFAULT 'OPERATIONS_ADMIN';

-- 3. Create Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    category public.dispute_category NOT NULL,
    reason TEXT NOT NULL,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    status public.dispute_status NOT NULL DEFAULT 'PENDING',
    admin_justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own disputes" ON public.disputes;
CREATE POLICY "Employees can view own disputes" ON public.disputes
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can create disputes" ON public.disputes;
CREATE POLICY "Employees can create disputes" ON public.disputes
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Admins manage all disputes" ON public.disputes;
CREATE POLICY "Admins manage all disputes" ON public.disputes
    FOR ALL USING (public.is_admin());

DROP TRIGGER IF EXISTS update_disputes_modtime ON public.disputes;
CREATE TRIGGER update_disputes_modtime
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 4. Deploy Transactional Late Recalculator Function
CREATE OR REPLACE FUNCTION public.recalculate_employee_lates_safe(
    p_employee_id UUID, 
    p_year INTEGER, 
    p_month INTEGER
) RETURNS VOID AS $$
DECLARE
  v_locked_emp_id UUID;
  v_unexempted_ids UUID[];
  v_all_ids UUID[];
  v_start_date DATE := to_date(p_year || '-' || lpad(p_month::text, 2, '0') || '-01', 'YYYY-MM-DD');
  v_end_date DATE := v_start_date + interval '1 month';
BEGIN
  -- Lock parent employee record to serialise lates adjustments
  SELECT id INTO v_locked_emp_id 
  FROM public.employees 
  WHERE id = p_employee_id 
  FOR UPDATE;

  -- Lock monthly attendance rows for employee
  SELECT COALESCE(array_agg(id ORDER BY date ASC), '{}') INTO v_all_ids
  FROM public.attendance
  WHERE employee_id = p_employee_id 
    AND date >= v_start_date 
    AND date < v_end_date
  FOR UPDATE;

  -- Fetch unexempted lates
  SELECT COALESCE(array_agg(id ORDER BY date ASC), '{}') INTO v_unexempted_ids
  FROM public.attendance
  WHERE employee_id = p_employee_id
    AND is_late = true
    AND date >= v_start_date
    AND date < v_end_date
    AND NOT COALESCE(late_approved, false)
    AND NOT COALESCE(permission_approved, false)
    AND NOT COALESCE(shift_override, false)
    AND NOT COALESCE(manager_exemption, false)
    AND status <> 'Approved WFH';

  -- Clear deductions in the locked set
  IF array_length(v_all_ids, 1) > 0 THEN
    UPDATE public.attendance
    SET deduction_applied = 0.0
    WHERE id = ANY(v_all_ids);
  END IF;

  -- Apply targeted deductions
  IF array_length(v_unexempted_ids, 1) >= 6 THEN
    UPDATE public.attendance
    SET deduction_applied = 0.5
    WHERE id = ANY(ARRAY[v_unexempted_ids[3], v_unexempted_ids[6]]);
  ELSIF array_length(v_unexempted_ids, 1) >= 3 THEN
    UPDATE public.attendance
    SET deduction_applied = 0.5
    WHERE id = v_unexempted_ids[3];
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- MIGRATION 8: Event Sourcing Trigger and Rebuild Updates
-- ====================================================================

-- 1. Apply Event to Projection Trigger Function (with Overrides support)
CREATE OR REPLACE FUNCTION public.apply_event_to_projection()
RETURNS TRIGGER AS $$
DECLARE
    v_prod_delta INT := 0;
    v_break_delta INT := 0;
    v_last_time TIMESTAMPTZ;
    v_state_val VARCHAR;
BEGIN
    -- Handle ADMIN_OVERRIDE event type
    IF NEW.event_type = 'ADMIN_OVERRIDE' THEN
        IF (NEW.payload->>'override_field') = 'late_approved' THEN
            UPDATE public.attendance SET late_approved = (NEW.payload->>'new_value')::boolean WHERE id = NEW.session_id;
        ELSIF (NEW.payload->>'override_field') = 'permission_approved' THEN
            UPDATE public.attendance SET permission_approved = (NEW.payload->>'new_value')::boolean WHERE id = NEW.session_id;
        ELSIF (NEW.payload->>'override_field') = 'shift_override' THEN
            UPDATE public.attendance SET shift_override = (NEW.payload->>'new_value')::boolean WHERE id = NEW.session_id;
        ELSIF (NEW.payload->>'override_field') = 'manager_exemption' THEN
            UPDATE public.attendance SET manager_exemption = (NEW.payload->>'new_value')::boolean WHERE id = NEW.session_id;
        ELSIF (NEW.payload->>'override_field') = 'status' THEN
            UPDATE public.attendance SET status = (NEW.payload->>'new_value')::text WHERE id = NEW.session_id;
            UPDATE public.attendance_projections SET current_state = (NEW.payload->>'new_value')::text WHERE session_id = NEW.session_id;
        ELSIF (NEW.payload->>'override_field') = 'check_out' THEN
            UPDATE public.attendance SET check_out = (NEW.payload->>'new_value')::timestamp with time zone WHERE id = NEW.session_id;
        END IF;

        UPDATE public.attendance_projections
        SET
            updated_at = now(),
            session_version = session_version + 1
        WHERE session_id = NEW.session_id;

        RETURN NEW;
    END IF;

    -- Fetch the last processed state and timestamp
    SELECT current_state, last_heartbeat_at 
    INTO v_state_val, v_last_time
    FROM public.attendance_projections
    WHERE session_id = NEW.session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        IF NEW.event_type = 'CLOCK_IN' THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version
            ) VALUES (
                NEW.session_id, NEW.employee_id, 'ACTIVE', NEW.event_timestamp, true, 1
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Calculate delta timing
    IF v_state_val = 'ACTIVE' THEN
        v_prod_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    ELSIF v_state_val = 'ON_BREAK' OR v_state_val = 'AUTO_BREAK' THEN
        v_break_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    END IF;

    CASE NEW.event_type
        WHEN 'BREAK_STARTED' THEN v_state_val := 'ON_BREAK';
        WHEN 'AUTO_BREAK_TRIGGERED' THEN v_state_val := 'AUTO_BREAK';
        WHEN 'BREAK_ENDED', 'GPS_REENTRY' THEN v_state_val := 'ACTIVE';
        WHEN 'GPS_EXIT' THEN v_state_val := 'GEO_OUTSIDE';
        WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN v_state_val := 'CLOCKED_OUT';
        ELSE
            -- Keep state
    END CASE;

    UPDATE public.attendance_projections
    SET
        current_state = v_state_val,
        productive_seconds = productive_seconds + COALESCE(v_prod_delta, 0),
        break_seconds = break_seconds + COALESCE(v_break_delta, 0),
        last_heartbeat_at = NEW.event_timestamp,
        session_version = session_version + 1,
        updated_at = now()
    WHERE session_id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_apply_events ON public.attendance_events;
CREATE TRIGGER trg_apply_events
    AFTER INSERT ON public.attendance_events
    FOR EACH ROW EXECUTE FUNCTION public.apply_event_to_projection();

-- 2. Update Rebuild Function to replay override and clockout metadata
CREATE OR REPLACE FUNCTION public.rebuild_attendance_projection(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
    v_calculated RECORD;
    v_emp_id UUID;
    r RECORD;
BEGIN
    SELECT employee_id INTO v_emp_id FROM public.attendance WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session ID % not found.', p_session_id;
    END IF;

    DELETE FROM public.attendance_projections WHERE session_id = p_session_id;

    SELECT * INTO v_calculated FROM public.get_session_state(p_session_id);

    INSERT INTO public.attendance_projections (
        session_id,
        employee_id,
        current_state,
        productive_seconds,
        break_seconds,
        last_heartbeat_at,
        session_version
    ) VALUES (
        p_session_id,
        v_emp_id,
        v_calculated.current_state,
        v_calculated.total_productive_seconds,
        v_calculated.total_break_seconds,
        now(),
        1
    );

    UPDATE public.attendance
    SET 
        status = v_calculated.current_state,
        check_out = NULL,
        late_approved = false,
        permission_approved = false,
        shift_override = false,
        manager_exemption = false
    WHERE id = p_session_id;

    FOR r IN 
        SELECT event_type, payload, event_timestamp 
        FROM public.attendance_events 
        WHERE session_id = p_session_id 
        ORDER BY sequence_number ASC 
    LOOP
        IF r.event_type = 'ADMIN_OVERRIDE' THEN
            IF (r.payload->>'override_field') = 'late_approved' THEN
                UPDATE public.attendance SET late_approved = (r.payload->>'new_value')::boolean WHERE id = p_session_id;
            ELSIF (r.payload->>'override_field') = 'permission_approved' THEN
                UPDATE public.attendance SET permission_approved = (r.payload->>'new_value')::boolean WHERE id = p_session_id;
            ELSIF (r.payload->>'override_field') = 'shift_override' THEN
                UPDATE public.attendance SET shift_override = (r.payload->>'new_value')::boolean WHERE id = p_session_id;
            ELSIF (r.payload->>'override_field') = 'manager_exemption' THEN
                UPDATE public.attendance SET manager_exemption = (r.payload->>'new_value')::boolean WHERE id = p_session_id;
            ELSIF (r.payload->>'override_field') = 'status' THEN
                UPDATE public.attendance SET status = (r.payload->>'new_value')::text WHERE id = p_session_id;
                UPDATE public.attendance_projections SET current_state = (r.payload->>'new_value')::text WHERE session_id = p_session_id;
            ELSIF (r.payload->>'override_field') = 'check_out' THEN
                UPDATE public.attendance SET check_out = (r.payload->>'new_value')::timestamp with time zone WHERE id = p_session_id;
            END IF;
        ELSIF r.event_type = 'CLOCK_OUT' OR r.event_type = 'FORCE_LOGOUT' THEN
            UPDATE public.attendance SET check_out = r.event_timestamp WHERE id = p_session_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- MIGRATION 7: Add foreign key constraint to attendance_projections
-- ============================================================

-- 1. Safely remove orphaned projections to prevent constraint violation
DELETE FROM public.attendance_projections
WHERE session_id NOT IN (SELECT id FROM public.attendance);

-- 2. Establish foreign key constraint mapping session_id to attendance.id
ALTER TABLE public.attendance_projections
DROP CONSTRAINT IF EXISTS fk_attendance_projections_attendance;

ALTER TABLE public.attendance_projections
ADD CONSTRAINT fk_attendance_projections_attendance
FOREIGN KEY (session_id) REFERENCES public.attendance(id)
ON DELETE CASCADE;


-- ====================================================================
-- DONE — All migrations applied successfully
-- ====================================================================
SELECT 'All migrations applied successfully!' AS result;

