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

  -- Lock monthly attendance rows for employee first (without aggregate)
  PERFORM id FROM public.attendance
  WHERE employee_id = p_employee_id 
    AND date >= v_start_date 
    AND date < v_end_date
  FOR UPDATE;

  -- Now aggregate the IDs safely
  SELECT COALESCE(array_agg(id ORDER BY date ASC), '{}') INTO v_all_ids
  FROM public.attendance
  WHERE employee_id = p_employee_id 
    AND date >= v_start_date 
    AND date < v_end_date;

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


-- ============================================================
-- MIGRATION 8: Fix Attendance Duration Caching & Rebuild Mapping
-- ============================================================

-- 1. Redefine get_session_state to return current_break_start TIMESTAMPTZ
DROP FUNCTION IF EXISTS public.get_session_state(UUID);

CREATE OR REPLACE FUNCTION public.get_session_state(p_session_id UUID)
RETURNS TABLE (
    current_state VARCHAR,
    total_productive_seconds INT,
    total_break_seconds INT,
    last_known_gps POINT,
    is_active BOOLEAN,
    device_type VARCHAR,
    device_label VARCHAR,
    current_break_start TIMESTAMPTZ
) AS $$
DECLARE
    r RECORD;
    v_state VARCHAR := 'Logged Out';
    v_last_event_time TIMESTAMPTZ;
    v_prod_sec INT := 0;
    v_break_sec INT := 0;
    v_break_start TIMESTAMPTZ := NULL;
    v_work_start TIMESTAMPTZ := NULL;
    v_last_gps POINT := NULL;
    v_device_type VARCHAR := NULL;
    v_device_label VARCHAR := NULL;
BEGIN
    FOR r IN 
        SELECT event_type, event_timestamp, gps_lat, gps_lng, payload 
        FROM public.attendance_events 
        WHERE session_id = p_session_id 
        ORDER BY sequence_number ASC 
    LOOP
        v_last_event_time := r.event_timestamp;
        IF r.gps_lat IS NOT NULL THEN
            v_last_gps := point(r.gps_lng, r.gps_lat);
        END IF;

        IF r.payload ? 'device_type' THEN
            v_device_type := (r.payload->>'device_type')::varchar;
            v_device_label := (r.payload->>'device_label')::varchar;
        END IF;

        CASE r.event_type
            WHEN 'CLOCK_IN', 'MOBILE_CLOCK_IN', 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED', 'GPS_REENTRY', 'BREAK_ENDED', 'SESSION_RECOVERED' THEN
                v_state := 'Working';
                IF v_work_start IS NULL THEN
                    v_work_start := r.event_timestamp;
                END IF;
                IF v_break_start IS NOT NULL THEN
                    v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_break_start))::INT;
                    v_break_start := NULL;
                END IF;

            WHEN 'IDLE_DETECTED', 'IDLE_WARNING_SHOWN' THEN
                v_state := 'Idle';
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;

            WHEN 'BREAK_STARTED' THEN
                v_state := 'Break';
                v_break_start := r.event_timestamp;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;

            WHEN 'AUTO_BREAK_TRIGGERED', 'GPS_EXIT', 'DESKTOP_SESSION_MISSING', 'PRODUCTIVE_TIMER_PAUSED' THEN
                v_state := 'Break (Auto)';
                v_break_start := r.event_timestamp;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;

            WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN
                v_state := 'Logged Out';
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;
                IF v_break_start IS NOT NULL THEN
                    v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_break_start))::INT;
                    v_break_start := NULL;
                END IF;
            ELSE
                -- Keep current state for telemetry events
        END CASE;
    END LOOP;

    -- Handle ongoing time if session is still active
    IF v_state = 'Working' AND v_work_start IS NOT NULL THEN
        v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (now() - v_work_start))::INT;
    ELSIF (v_state = 'Break' OR v_state = 'Break (Auto)') AND v_break_start IS NOT NULL THEN
        v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (now() - v_break_start))::INT;
    END IF;

    RETURN QUERY SELECT v_state, v_prod_sec, v_break_sec, v_last_gps, (v_state != 'Logged Out'), v_device_type, v_device_label, v_break_start;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 2. Redefine apply_event_to_projection to sync calculations back to public.attendance
CREATE OR REPLACE FUNCTION public.apply_event_to_projection()
RETURNS TRIGGER AS $$
DECLARE
    v_prod_delta INT := 0;
    v_break_delta INT := 0;
    v_last_time TIMESTAMPTZ;
    v_state_val VARCHAR;
    v_new_prod_sec INT;
    v_new_break_sec INT;
    v_curr_break_start TIMESTAMPTZ;
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

    -- Fetch the last processed state, timestamp, and accumulated seconds of the projection
    SELECT current_state, last_heartbeat_at, productive_seconds, break_seconds
    INTO v_state_val, v_last_time, v_new_prod_sec, v_new_break_sec
    FROM public.attendance_projections
    WHERE session_id = NEW.session_id
    FOR UPDATE;

    -- Fetch the current break start time from attendance
    SELECT current_break_start INTO v_curr_break_start
    FROM public.attendance
    WHERE id = NEW.session_id;

    -- If projection does not exist, initialize it
    IF NOT FOUND THEN
        IF NEW.event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN') THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version, device_type, device_label
            ) VALUES (
                NEW.session_id, NEW.employee_id, 'Working', NEW.event_timestamp, true, 1, 
                COALESCE((NEW.payload->>'device_type')::varchar, 'desktop'),
                COALESCE((NEW.payload->>'device_label')::varchar, 'Desktop')
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Calculate delta timing based on state transition
    IF v_state_val = 'Working' THEN
        v_prod_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    ELSIF v_state_val IN ('Break', 'Break (Auto)') THEN
        v_break_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    END IF;

    v_new_prod_sec := v_new_prod_sec + COALESCE(v_prod_delta, 0);
    v_new_break_sec := v_new_break_sec + COALESCE(v_break_delta, 0);

    -- Update state mapping based on new event
    CASE NEW.event_type
        WHEN 'CLOCK_IN', 'MOBILE_CLOCK_IN', 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED', 'GPS_REENTRY', 'BREAK_ENDED', 'SESSION_RECOVERED' THEN
            v_state_val := 'Working';
        WHEN 'IDLE_DETECTED', 'IDLE_WARNING_SHOWN' THEN
            v_state_val := 'Idle';
        WHEN 'BREAK_STARTED' THEN
            v_state_val := 'Break';
        WHEN 'AUTO_BREAK_TRIGGERED', 'GPS_EXIT', 'DESKTOP_SESSION_MISSING', 'PRODUCTIVE_TIMER_PAUSED' THEN
            v_state_val := 'Break (Auto)';
        WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN
            v_state_val := 'Logged Out';
        ELSE
            -- Keep current state for telemetry events
    END CASE;

    -- Resolve current_break_start based on the new state
    IF v_state_val IN ('Break', 'Break (Auto)') THEN
        IF v_curr_break_start IS NULL THEN
            v_curr_break_start := NEW.event_timestamp;
        END IF;
    ELSE
        v_curr_break_start := NULL;
    END IF;

    -- Update the projection cache
    UPDATE public.attendance_projections
    SET
        current_state = v_state_val,
        productive_seconds = v_new_prod_sec,
        break_seconds = v_new_break_sec,
        last_heartbeat_at = NEW.event_timestamp,
        session_version = session_version + 1,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label),
        updated_at = now()
    WHERE session_id = NEW.session_id;

    -- Also cache on public.attendance, including total_break_seconds, productive_hours, and current_break_start
    UPDATE public.attendance
    SET
        status = v_state_val,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label),
        total_break_seconds = v_new_break_sec,
        productive_hours = ROUND((v_new_prod_sec::numeric / 3600.0), 2),
        current_break_start = v_curr_break_start
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Redefine rebuild_attendance_projection to sync calculations back to public.attendance
CREATE OR REPLACE FUNCTION public.rebuild_attendance_projection(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
    v_calculated RECORD;
    v_emp_id UUID;
    r RECORD;
BEGIN
    -- 1. Fetch employee ID from master session
    SELECT employee_id INTO v_emp_id FROM public.attendance WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session ID % not found.', p_session_id;
    END IF;

    -- 2. Lock and delete old projection
    DELETE FROM public.attendance_projections WHERE session_id = p_session_id;

    -- 3. Calculate time states from events stream
    SELECT * INTO v_calculated FROM public.get_session_state(p_session_id);

    -- 4. Re-insert projection record
    INSERT INTO public.attendance_projections (
        session_id,
        employee_id,
        current_state,
        productive_seconds,
        break_seconds,
        last_heartbeat_at,
        session_version,
        device_type,
        device_label
    ) VALUES (
        p_session_id,
        v_emp_id,
        v_calculated.current_state,
        v_calculated.total_productive_seconds,
        v_calculated.total_break_seconds,
        now(),
        1,
        v_calculated.device_type,
        v_calculated.device_label
    );

    -- 5. Reset the master attendance cached fields that can be modified by overrides, including break seconds, productive hours, and current break start
    UPDATE public.attendance
    SET 
        status = v_calculated.current_state,
        check_out = NULL,
        late_approved = false,
        permission_approved = false,
        shift_override = false,
        manager_exemption = false,
        device_type = v_calculated.device_type,
        device_label = v_calculated.device_label,
        total_break_seconds = v_calculated.total_break_seconds,
        productive_hours = ROUND((v_calculated.total_productive_seconds::numeric / 3600.0), 2),
        current_break_start = v_calculated.current_break_start
    WHERE id = p_session_id;

    -- 6. Replay all event overrides to restore status, check_out, and exemptions
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
            -- Restore check_out value from original clock_out event timestamp
            UPDATE public.attendance SET check_out = r.event_timestamp WHERE id = p_session_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Rebuild all existing projections to synchronize status, total_break_seconds, productive_hours, and current_break_start in public.attendance
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.attendance LOOP
        BEGIN
            PERFORM public.rebuild_attendance_projection(r.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not rebuild projection for session %: %', r.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- ====================================================================
-- MIGRATION 9: Fix WFH Heartbeat Tracking and Auto Clock-Out Resumption
-- ====================================================================

-- 1. Redefine get_session_state to correctly map active state to 'Approved WFH' or 'Pending WFH'
DROP FUNCTION IF EXISTS public.get_session_state(UUID);

CREATE OR REPLACE FUNCTION public.get_session_state(p_session_id UUID)
RETURNS TABLE (
    current_state VARCHAR,
    total_productive_seconds INT,
    total_break_seconds INT,
    last_known_gps POINT,
    is_active BOOLEAN,
    device_type VARCHAR,
    device_label VARCHAR,
    current_break_start TIMESTAMPTZ
) AS $$
DECLARE
    r RECORD;
    v_state VARCHAR := 'Logged Out';
    v_last_event_time TIMESTAMPTZ;
    v_prod_sec INT := 0;
    v_break_sec INT := 0;
    v_break_start TIMESTAMPTZ := NULL;
    v_work_start TIMESTAMPTZ := NULL;
    v_last_gps POINT := NULL;
    v_device_type VARCHAR := NULL;
    v_device_label VARCHAR := NULL;
    v_is_wfh BOOLEAN := FALSE;
    v_att_status VARCHAR := NULL;
BEGIN
    -- Check if session has Approved WFH override in its history or is pending WFH
    SELECT status INTO v_att_status FROM public.attendance WHERE id = p_session_id;

    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events 
        WHERE session_id = p_session_id 
          AND event_type = 'ADMIN_OVERRIDE' 
          AND (payload->>'override_field') = 'status' 
          AND (payload->>'new_value') = 'Approved WFH'
    ) INTO v_is_wfh;

    FOR r IN 
        SELECT event_type, event_timestamp, gps_lat, gps_lng, payload 
        FROM public.attendance_events 
        WHERE session_id = p_session_id 
        ORDER BY sequence_number ASC 
    LOOP
        v_last_event_time := r.event_timestamp;
        IF r.gps_lat IS NOT NULL THEN
            v_last_gps := point(r.gps_lng, r.gps_lat);
        END IF;

        IF r.payload ? 'device_type' THEN
            v_device_type := (r.payload->>'device_type')::varchar;
            v_device_label := (r.payload->>'device_label')::varchar;
        END IF;

        CASE r.event_type
            WHEN 'CLOCK_IN', 'MOBILE_CLOCK_IN', 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED', 'GPS_REENTRY', 'BREAK_ENDED', 'SESSION_RECOVERED' THEN
                IF v_is_wfh THEN
                    v_state := 'Approved WFH';
                ELSIF v_att_status = 'Pending WFH' THEN
                    v_state := 'Pending WFH';
                ELSE
                    v_state := 'Working';
                END IF;
                IF v_work_start IS NULL THEN
                    v_work_start := r.event_timestamp;
                END IF;
                IF v_break_start IS NOT NULL THEN
                    v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_break_start))::INT;
                    v_break_start := NULL;
                END IF;

            WHEN 'IDLE_DETECTED', 'IDLE_WARNING_SHOWN' THEN
                v_state := 'Idle';
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;

            WHEN 'BREAK_STARTED' THEN
                v_state := 'Break';
                v_break_start := r.event_timestamp;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;

            WHEN 'AUTO_BREAK_TRIGGERED', 'GPS_EXIT', 'DESKTOP_SESSION_MISSING', 'PRODUCTIVE_TIMER_PAUSED' THEN
                v_state := 'Break (Auto)';
                v_break_start := r.event_timestamp;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;

            WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN
                v_state := 'Logged Out';
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;
                IF v_break_start IS NOT NULL THEN
                    v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_break_start))::INT;
                    v_break_start := NULL;
                END IF;
            ELSE
                -- Keep current state for telemetry events
        END CASE;
    END LOOP;

    -- Handle ongoing time if session is still active
    IF (v_state = 'Working' OR v_state = 'Approved WFH') AND v_work_start IS NOT NULL THEN
        v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (now() - v_work_start))::INT;
    ELSIF (v_state = 'Break' OR v_state = 'Break (Auto)') AND v_break_start IS NOT NULL THEN
        v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (now() - v_break_start))::INT;
    END IF;

    RETURN QUERY SELECT v_state, v_prod_sec, v_break_sec, v_last_gps, (v_state != 'Logged Out'), v_device_type, v_device_label, v_break_start;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 2. Redefine apply_event_to_projection to support WFH status tracking and Pending WFH initialization
CREATE OR REPLACE FUNCTION public.apply_event_to_projection()
RETURNS TRIGGER AS $$
DECLARE
    v_prod_delta INT := 0;
    v_break_delta INT := 0;
    v_last_time TIMESTAMPTZ;
    v_state_val VARCHAR;
    v_new_prod_sec INT;
    v_new_break_sec INT;
    v_curr_break_start TIMESTAMPTZ;
    v_is_wfh BOOLEAN := FALSE;
    v_attendance_status VARCHAR := NULL;
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

    -- Fetch the last processed state, timestamp, and accumulated seconds of the projection
    SELECT current_state, last_heartbeat_at, productive_seconds, break_seconds
    INTO v_state_val, v_last_time, v_new_prod_sec, v_new_break_sec
    FROM public.attendance_projections
    WHERE session_id = NEW.session_id
    FOR UPDATE;

    -- Fetch the current break start time and status from attendance
    SELECT current_break_start, status INTO v_curr_break_start, v_attendance_status
    FROM public.attendance
    WHERE id = NEW.session_id;

    -- Check if session has Approved WFH override in its history
    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events 
        WHERE session_id = NEW.session_id 
          AND event_type = 'ADMIN_OVERRIDE' 
          AND (payload->>'override_field') = 'status' 
          AND (payload->>'new_value') = 'Approved WFH'
    ) INTO v_is_wfh;

    -- If projection does not exist, initialize it
    IF NOT FOUND THEN
        IF NEW.event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN') THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version, device_type, device_label
            ) VALUES (
                NEW.session_id, NEW.employee_id, 
                CASE 
                    WHEN v_is_wfh THEN 'Approved WFH'::varchar 
                    WHEN v_attendance_status = 'Pending WFH' THEN 'Pending WFH'::varchar
                    ELSE 'Working'::varchar 
                END, 
                NEW.event_timestamp, true, 1, 
                COALESCE((NEW.payload->>'device_type')::varchar, 'desktop'),
                COALESCE((NEW.payload->>'device_label')::varchar, 'Desktop')
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Calculate delta timing based on state transition
    IF v_state_val = 'Working' OR v_state_val = 'Approved WFH' THEN
        v_prod_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    ELSIF v_state_val IN ('Break', 'Break (Auto)') THEN
        v_break_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    END IF;

    v_new_prod_sec := v_new_prod_sec + COALESCE(v_prod_delta, 0);
    v_new_break_sec := v_new_break_sec + COALESCE(v_break_delta, 0);

    -- Update state mapping based on new event
    CASE NEW.event_type
        WHEN 'CLOCK_IN', 'MOBILE_CLOCK_IN', 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED', 'GPS_REENTRY', 'BREAK_ENDED', 'SESSION_RECOVERED' THEN
            IF v_is_wfh THEN
                v_state_val := 'Approved WFH';
            ELSIF v_attendance_status = 'Pending WFH' THEN
                v_state_val := 'Pending WFH';
            ELSE
                v_state_val := 'Working';
            END IF;
        WHEN 'IDLE_DETECTED', 'IDLE_WARNING_SHOWN' THEN
            v_state_val := 'Idle';
        WHEN 'BREAK_STARTED' THEN
            v_state_val := 'Break';
        WHEN 'AUTO_BREAK_TRIGGERED', 'GPS_EXIT', 'DESKTOP_SESSION_MISSING', 'PRODUCTIVE_TIMER_PAUSED' THEN
            v_state_val := 'Break (Auto)';
        WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN
            v_state_val := 'Logged Out';
        ELSE
            -- Keep current state for telemetry events
    END CASE;

    -- Resolve current_break_start based on the new state
    IF v_state_val IN ('Break', 'Break (Auto)') THEN
        IF v_curr_break_start IS NULL THEN
            v_curr_break_start := NEW.event_timestamp;
        END IF;
    ELSE
        v_curr_break_start := NULL;
    END IF;

    -- Update the projection cache
    UPDATE public.attendance_projections
    SET
        current_state = v_state_val,
        productive_seconds = v_new_prod_sec,
        break_seconds = v_new_break_sec,
        last_heartbeat_at = NEW.event_timestamp,
        session_version = session_version + 1,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label),
        updated_at = now()
    WHERE session_id = NEW.session_id;

    -- Also cache on public.attendance, including total_break_seconds, productive_hours, and current_break_start
    UPDATE public.attendance
    SET
        status = v_state_val,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label),
        total_break_seconds = v_new_break_sec,
        productive_hours = ROUND((v_new_prod_sec::numeric / 3600.0), 2),
        current_break_start = v_curr_break_start
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Redefine rebuild_attendance_projection to sync calculations and duration_hours back to public.attendance
CREATE OR REPLACE FUNCTION public.rebuild_attendance_projection(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
    v_calculated RECORD;
    v_emp_id UUID;
    r RECORD;
BEGIN
    -- 1. Fetch employee ID from master session
    SELECT employee_id INTO v_emp_id FROM public.attendance WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session ID % not found.', p_session_id;
    END IF;

    -- 2. Lock and delete old projection
    DELETE FROM public.attendance_projections WHERE session_id = p_session_id;

    -- 3. Calculate time states from events stream
    SELECT * INTO v_calculated FROM public.get_session_state(p_session_id);

    -- 4. Re-insert projection record
    INSERT INTO public.attendance_projections (
        session_id,
        employee_id,
        current_state,
        productive_seconds,
        break_seconds,
        last_heartbeat_at,
        session_version,
        device_type,
        device_label
    ) VALUES (
        p_session_id,
        v_emp_id,
        v_calculated.current_state,
        v_calculated.total_productive_seconds,
        v_calculated.total_break_seconds,
        now(),
        1,
        v_calculated.device_type,
        v_calculated.device_label
    );

    -- 5. Reset the master attendance cached fields that can be modified by overrides, including break seconds, productive hours, and current break start
    UPDATE public.attendance
    SET 
        status = v_calculated.current_state,
        check_out = NULL,
        late_approved = false,
        permission_approved = false,
        shift_override = false,
        manager_exemption = false,
        device_type = v_calculated.device_type,
        device_label = v_calculated.device_label,
        total_break_seconds = v_calculated.total_break_seconds,
        productive_hours = ROUND((v_calculated.total_productive_seconds::numeric / 3600.0), 2),
        current_break_start = v_calculated.current_break_start
    WHERE id = p_session_id;

    -- 6. Replay all event overrides to restore status, check_out, and exemptions
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
            -- Restore check_out value from original clock_out event timestamp and calculate duration_hours
            UPDATE public.attendance 
            SET 
                check_out = r.event_timestamp,
                duration_hours = ROUND((EXTRACT(EPOCH FROM (r.event_timestamp - check_in))::numeric / 3600.0), 2)
            WHERE id = p_session_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Redefine sweep_and_close_stale_sessions to exclude 'Break' and 'Break (Auto)' from heartbeat stale checks
CREATE OR REPLACE FUNCTION public.sweep_and_close_stale_sessions()
RETURNS JSONB AS $$
DECLARE
    v_stale RECORD;
    v_next_seq INT;
    v_closed_count INT := 0;
    v_skipped_count INT := 0;
    v_error_count INT := 0;
    v_now TIMESTAMPTZ := now();
    v_stale_reason TEXT;
    v_stale_duration_seconds INT;
    v_auto_checkout TIMESTAMPTZ;
BEGIN
    FOR v_stale IN
        SELECT a.id, a.employee_id, a.date, a.check_in, a.status,
               p.last_heartbeat_at
        FROM public.attendance a
        LEFT JOIN public.attendance_projections p ON p.session_id = a.id
        WHERE a.check_out IS NULL
          AND a.status IN ('Working', 'Idle', 'Break', 'Break (Auto)', 'Approved WFH')
          AND (
              -- Condition 1: Heartbeat stale (>30 minutes) ONLY for active Working, Idle, or WFH statuses
              (a.status IN ('Working', 'Idle', 'Approved WFH') AND p.last_heartbeat_at IS NOT NULL AND p.last_heartbeat_at < (v_now - INTERVAL '30 minutes'))
              -- Condition 2: Allowed shift duration exceeded (9 hours)
              OR (a.check_in IS NOT NULL AND a.check_in < (v_now - INTERVAL '9 hours'))
              -- Condition 3: Crossed the shift boundary cutoff (4:30 AM IST / 23:00 UTC of shift date, cast explicitly to UTC)
              OR (a.date IS NOT NULL AND v_now > (a.date + TIME '23:00:00') AT TIME ZONE 'UTC')
          )
        FOR UPDATE OF a SKIP LOCKED
    LOOP
        BEGIN
            -- Determine stale reason
            IF v_stale.check_in IS NOT NULL AND v_stale.check_in < (v_now - INTERVAL '9 hours') THEN
                v_stale_reason := 'shift_duration_exceeded';
                v_stale_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_stale.check_in))::INT;
            ELSIF v_stale.date IS NOT NULL AND v_now > (v_stale.date + TIME '23:00:00') AT TIME ZONE 'UTC' THEN
                v_stale_reason := 'cross_shift_boundary';
                v_stale_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_stale.check_in))::INT;
            ELSE
                v_stale_reason := 'heartbeat_timeout';
                v_stale_duration_seconds := CASE 
                    WHEN v_stale.last_heartbeat_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (v_now - v_stale.last_heartbeat_at))::INT
                    ELSE EXTRACT(EPOCH FROM (v_now - v_stale.check_in))::INT
                END;
            END IF;

            -- Calculate checkout timestamp
            IF v_stale_reason = 'shift_duration_exceeded' THEN
                v_auto_checkout := v_stale.check_in + INTERVAL '9 hours';
            ELSIF v_stale_reason = 'cross_shift_boundary' THEN
                v_auto_checkout := (v_stale.date + TIME '23:00:00') AT TIME ZONE 'UTC';
            ELSIF v_stale.last_heartbeat_at IS NOT NULL THEN
                v_auto_checkout := v_stale.last_heartbeat_at;
            ELSE
                v_auto_checkout := v_now;
            END IF;

            -- Get next sequence number
            SELECT COALESCE(MAX(sequence_number), 0) + 1
            INTO v_next_seq
            FROM public.attendance_events
            WHERE session_id = v_stale.id;

            -- Insert FORCE_LOGOUT event
            INSERT INTO public.attendance_events (
                session_id,
                employee_id,
                event_type,
                event_timestamp,
                sequence_number,
                idempotency_key,
                client_ip,
                payload
            ) VALUES (
                v_stale.id,
                v_stale.employee_id,
                'FORCE_LOGOUT',
                v_auto_checkout,
                v_next_seq,
                'sweep-' || v_stale.id::text || '-' || v_next_seq::text,
                '0.0.0.0',
                jsonb_build_object(
                    'forced_by', 'system_sweeper',
                    'stale_reason', v_stale_reason,
                    'stale_duration_seconds', v_stale_duration_seconds,
                    'last_heartbeat_at', v_stale.last_heartbeat_at,
                    'swept_at', v_now
                )
            );

            -- Rebuild projection
            PERFORM public.rebuild_attendance_projection(v_stale.id);

            v_closed_count := v_closed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to sweep session %: %', v_stale.id, SQLERRM;
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'closed', v_closed_count,
        'skipped', v_skipped_count,
        'errors', v_error_count,
        'swept_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Rebuild all existing projections to synchronize status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.attendance LOOP
        BEGIN
            PERFORM public.rebuild_attendance_projection(r.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not rebuild projection for session %: %', r.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- ====================================================================
-- MIGRATION: 20260528100000_disable_heartbeat_sweep_and_fix_resumption
-- ====================================================================

-- 1. Redefine sweep_and_close_stale_sessions to only sweep at shift boundaries (no heartbeat or 9-hour timeouts)
CREATE OR REPLACE FUNCTION public.sweep_and_close_stale_sessions()
RETURNS JSONB AS $$
DECLARE
    v_stale RECORD;
    v_next_seq INT;
    v_closed_count INT := 0;
    v_skipped_count INT := 0;
    v_error_count INT := 0;
    v_now TIMESTAMPTZ := now();
    v_stale_reason TEXT;
    v_stale_duration_seconds INT;
    v_auto_checkout TIMESTAMPTZ;
BEGIN
    FOR v_stale IN
        SELECT a.id, a.employee_id, a.date, a.check_in, a.status,
               p.last_heartbeat_at
        FROM public.attendance a
        LEFT JOIN public.attendance_projections p ON p.session_id = a.id
        WHERE a.check_out IS NULL
          AND a.status IN ('Working', 'Idle', 'Break', 'Break (Auto)', 'Approved WFH', 'Pending WFH')
          AND (
              -- Crossed the shift boundary cutoff (4:30 AM IST / 23:00 UTC of shift date, cast explicitly to UTC)
              (a.date IS NOT NULL AND v_now > (a.date + TIME '23:00:00') AT TIME ZONE 'UTC')
          )
        FOR UPDATE OF a SKIP LOCKED
    LOOP
        BEGIN
            v_stale_reason := 'cross_shift_boundary';
            v_stale_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_stale.check_in))::INT;

            -- Auto-checkout time at the actual shift boundary (3:30 AM IST / 22:00 UTC of shift date)
            v_auto_checkout := (v_stale.date + TIME '22:00:00') AT TIME ZONE 'UTC';
            
            -- Keep a safety guard: if they checked in after the official boundary, checkout is 1 minute after checkin
            IF v_auto_checkout <= v_stale.check_in THEN
                v_auto_checkout := v_stale.check_in + INTERVAL '1 minute';
            END IF;

            -- Get next sequence number
            SELECT COALESCE(MAX(sequence_number), 0) + 1
            INTO v_next_seq
            FROM public.attendance_events
            WHERE session_id = v_stale.id;

            -- Insert FORCE_LOGOUT event
            INSERT INTO public.attendance_events (
                session_id,
                employee_id,
                event_type,
                event_timestamp,
                sequence_number,
                idempotency_key,
                client_ip,
                payload
            ) VALUES (
                v_stale.id,
                v_stale.employee_id,
                'FORCE_LOGOUT',
                v_auto_checkout,
                v_next_seq,
                'sweep-' || v_stale.id::text || '-' || v_next_seq::text,
                '0.0.0.0',
                jsonb_build_object(
                    'forced_by', 'system_sweeper',
                    'stale_reason', v_stale_reason,
                    'stale_duration_seconds', v_stale_duration_seconds,
                    'last_heartbeat_at', v_stale.last_heartbeat_at,
                    'swept_at', v_now
                )
            );

            -- Rebuild projection
            PERFORM public.rebuild_attendance_projection(v_stale.id);

            v_closed_count := v_closed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to sweep session %: %', v_stale.id, SQLERRM;
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'closed', v_closed_count,
        'skipped', v_skipped_count,
        'errors', v_error_count,
        'swept_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine rebuild_attendance_projection to preserve manual exemptions and reset check_out on clock-in / resumptions
CREATE OR REPLACE FUNCTION public.rebuild_attendance_projection(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
    v_calculated RECORD;
    v_emp_id UUID;
    r RECORD;
    v_orig_late_approved BOOLEAN;
    v_orig_permission_approved BOOLEAN;
    v_orig_shift_override BOOLEAN;
    v_orig_manager_exemption BOOLEAN;
BEGIN
    -- 1. Fetch employee ID and existing exemption states from master session
    SELECT employee_id, late_approved, permission_approved, shift_override, manager_exemption
    INTO v_emp_id, v_orig_late_approved, v_orig_permission_approved, v_orig_shift_override, v_orig_manager_exemption
    FROM public.attendance
    WHERE id = p_session_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session ID % not found.', p_session_id;
    END IF;

    -- 2. Lock and delete old projection
    DELETE FROM public.attendance_projections WHERE session_id = p_session_id;

    -- 3. Calculate time states from events stream
    SELECT * INTO v_calculated FROM public.get_session_state(p_session_id);

    -- 4. Re-insert projection record
    INSERT INTO public.attendance_projections (
        session_id,
        employee_id,
        current_state,
        productive_seconds,
        break_seconds,
        last_heartbeat_at,
        session_version,
        device_type,
        device_label
    ) VALUES (
        p_session_id,
        v_emp_id,
        v_calculated.current_state,
        v_calculated.total_productive_seconds,
        v_calculated.total_break_seconds,
        now(),
        1,
        v_calculated.device_type,
        v_calculated.device_label
    );

    -- 5. Reset the master attendance cached fields, PRESERVING original database-level manual overrides/exemptions
    UPDATE public.attendance
    SET 
        status = v_calculated.current_state,
        check_out = NULL,
        late_approved = COALESCE(v_orig_late_approved, false),
        permission_approved = COALESCE(v_orig_permission_approved, false),
        shift_override = COALESCE(v_orig_shift_override, false),
        manager_exemption = COALESCE(v_orig_manager_exemption, false),
        device_type = v_calculated.device_type,
        device_label = v_calculated.device_label,
        total_break_seconds = v_calculated.total_break_seconds,
        productive_hours = ROUND((v_calculated.total_productive_seconds::numeric / 3600.0), 2),
        current_break_start = v_calculated.current_break_start
    WHERE id = p_session_id;

    -- 6. Replay all event overrides to restore status, check_out, and exemptions
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
            -- Restore check_out value from original clock_out event timestamp and calculate duration_hours
            UPDATE public.attendance 
            SET 
                check_out = r.event_timestamp,
                duration_hours = ROUND((EXTRACT(EPOCH FROM (r.event_timestamp - check_in))::numeric / 3600.0), 2)
            WHERE id = p_session_id;
        ELSIF r.event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN', 'SESSION_RECOVERED') THEN
            -- If checked back in or session resumed, clear check_out details
            UPDATE public.attendance 
            SET 
                check_out = NULL,
                duration_hours = NULL
            WHERE id = p_session_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebuild all projections again to make sure everything matches
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.attendance LOOP
        BEGIN
            PERFORM public.rebuild_attendance_projection(r.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not rebuild projection for session %: %', r.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- ====================================================================
-- DONE — All migrations applied successfully
-- ====================================================================
SELECT 'All migrations applied successfully!' AS result;

