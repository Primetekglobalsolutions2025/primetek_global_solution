-- ============================================================
-- Primetek Global Solutions — Attendance Accuracy Hardening Migration
-- Date: May 30, 2026
-- ============================================================

-- 1. Create Recovery Queue Table
CREATE TABLE IF NOT EXISTS public.attendance_recovery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL, -- 'check_in', 'check_out', 'wfh_request', 'break_start', 'break_end'
    original_timestamp TIMESTAMPTZ NOT NULL,
    gps_lat NUMERIC(10,6) NOT NULL,
    gps_lng NUMERIC(10,6) NOT NULL,
    device_fingerprint TEXT,
    error_message TEXT,
    status VARCHAR(16) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    resolved_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.attendance_recovery_queue ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exist
DROP POLICY IF EXISTS "Employees can view own recovery requests" ON public.attendance_recovery_queue;
DROP POLICY IF EXISTS "Employees can insert own recovery requests" ON public.attendance_recovery_queue;
DROP POLICY IF EXISTS "Admins manage all recovery requests" ON public.attendance_recovery_queue;

-- Create Policies
CREATE POLICY "Employees can view own recovery requests" ON public.attendance_recovery_queue
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Employees can insert own recovery requests" ON public.attendance_recovery_queue
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admins manage all recovery requests" ON public.attendance_recovery_queue
    FOR ALL USING (public.is_admin());

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS update_recovery_queue_modtime ON public.attendance_recovery_queue;
CREATE TRIGGER update_recovery_queue_modtime
    BEFORE UPDATE ON public.attendance_recovery_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


-- 2. Implement Current-Shift Real-Time Heartbeat Sweeper
CREATE OR REPLACE FUNCTION public.sweep_active_sessions_telemetry()
RETURNS JSONB AS $$
DECLARE
    v_stale RECORD;
    v_next_seq INT;
    v_now TIMESTAMPTZ := now();
    v_idle_threshold INT := 180;      -- 3 minutes
    v_autobreak_threshold INT := 300;  -- 5 minutes
    v_logout_threshold INT := 900;     -- 15 minutes
    v_diff INT;
    v_new_state VARCHAR;
    v_event_type VARCHAR;
    v_updated_count INT := 0;
BEGIN
    -- Find checked-in sessions that are active (not logged out)
    FOR v_stale IN
        SELECT a.id, a.employee_id, a.status, a.current_break_start, a.lat, a.lng,
               p.last_heartbeat_at, p.current_state
        FROM public.attendance a
        JOIN public.attendance_projections p ON p.session_id = a.id
        WHERE a.check_out IS NULL
          AND p.current_state <> 'Logged Out'
        FOR UPDATE OF a
    LOOP
        v_diff := EXTRACT(EPOCH FROM (v_now - v_stale.last_heartbeat_at))::INT;
        v_new_state := NULL;

        -- Transition logic
        IF v_stale.current_state IN ('Working', 'Approved WFH') AND v_diff >= v_idle_threshold AND v_diff < v_autobreak_threshold THEN
            v_new_state := 'Idle';
            v_event_type := 'IDLE_DETECTED';
        ELSIF v_stale.current_state IN ('Working', 'Approved WFH', 'Idle') AND v_diff >= v_autobreak_threshold AND v_diff < v_logout_threshold THEN
            v_new_state := 'Break (Auto)';
            v_event_type := 'AUTO_BREAK_TRIGGERED';
        ELSIF v_stale.current_state IN ('Break', 'Break (Auto)', 'Idle') AND v_diff >= v_logout_threshold THEN
            v_new_state := 'Logged Out';
            v_event_type := 'FORCE_LOGOUT';
        END IF;

        IF v_new_state IS NOT NULL THEN
            -- Get next sequence number
            SELECT COALESCE(MAX(sequence_number), 0) + 1
            INTO v_next_seq
            FROM public.attendance_events
            WHERE session_id = v_stale.id;

            -- Insert transition/logout event.
            -- If it's a FORCE_LOGOUT, we backdate the event timestamp to the last known heartbeat time to prevent leakage.
            INSERT INTO public.attendance_events (
                session_id,
                employee_id,
                event_type,
                event_timestamp,
                sequence_number,
                idempotency_key,
                client_ip,
                gps_lat,
                gps_lng,
                payload
            ) VALUES (
                v_stale.id,
                v_stale.employee_id,
                v_event_type::public.attendance_event_type,
                CASE WHEN v_new_state = 'Logged Out' THEN v_stale.last_heartbeat_at ELSE v_now END,
                v_next_seq,
                'tele-sweep-' || v_stale.id::text || '-' || v_event_type || '-' || v_next_seq::text,
                '0.0.0.0'::inet,
                v_stale.lat,
                v_stale.lng,
                jsonb_build_object(
                    'swept_at', v_now,
                    'last_heartbeat_at', v_stale.last_heartbeat_at,
                    'inactivity_seconds', v_diff,
                    'reason', 'heartbeat_timeout'
                )
            );

            -- Rebuild projection
            PERFORM public.rebuild_attendance_projection(v_stale.id);
            v_updated_count := v_updated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'swept_at', v_now,
        'updated_count', v_updated_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Redefine get_realtime_attendance_metrics to be accurate
CREATE OR REPLACE FUNCTION public.get_realtime_attendance_metrics(
  p_shift_date DATE,
  p_shift_start_utc TIMESTAMPTZ
)
RETURNS TABLE (
  active_workforce BIGINT,
  active_breaks BIGINT,
  idle_warnings BIGINT,
  gps_alerts BIGINT,
  mobile_sessions BIGINT,
  auto_breaks BIGINT,
  pending_disputes BIGINT,
  stale_sessions BIGINT
) AS $$
DECLARE
  v_active_workforce BIGINT;
  v_active_breaks BIGINT;
  v_idle_warnings BIGINT;
  v_gps_alerts BIGINT;
  v_mobile_sessions BIGINT;
  v_auto_breaks BIGINT;
  v_pending_disputes BIGINT;
  v_stale_sessions BIGINT;
BEGIN
  -- 1. active_workforce: Include Working, Idle, Approved WFH, Pending WFH
  SELECT COUNT(*) INTO v_active_workforce
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND status IN ('Working', 'Idle', 'Approved WFH', 'Pending WFH');

  -- 2. active_breaks
  SELECT COUNT(*) INTO v_active_breaks
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND status IN ('Break', 'Break (Auto)');

  -- 3. idle_warnings
  SELECT COUNT(*) INTO v_idle_warnings
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND status = 'Idle';

  -- 4. gps_alerts (Active geofence exits: only those not resolved by reentry or checkout)
  SELECT COUNT(*) INTO v_gps_alerts
  FROM public.attendance a
  WHERE a.date = p_shift_date
    AND a.check_out IS NULL
    AND EXISTS (
        SELECT 1 FROM (
            SELECT event_type
            FROM public.attendance_events
            WHERE session_id = a.id
              AND event_type IN ('GPS_EXIT', 'GPS_REENTRY')
            ORDER BY sequence_number DESC
            LIMIT 1
        ) latest_geo
        WHERE latest_geo.event_type = 'GPS_EXIT'
    );

  -- 5. mobile_sessions
  SELECT COUNT(*) INTO v_mobile_sessions
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND device_type = 'mobile';

  -- 6. auto_breaks
  SELECT COUNT(*) INTO v_auto_breaks
  FROM public.attendance_events
  WHERE event_type = 'AUTO_BREAK_TRIGGERED'
    AND event_timestamp >= p_shift_start_utc;

  -- 7. pending_disputes: includes pending disputes AND pending recovery queue requests
  SELECT (
    (SELECT COUNT(*) FROM public.disputes WHERE status = 'PENDING') +
    (SELECT COUNT(*) FROM public.attendance_recovery_queue WHERE status = 'PENDING')
  ) INTO v_pending_disputes;

  -- 8. stale_sessions
  SELECT COUNT(*) INTO v_stale_sessions
  FROM public.attendance
  WHERE check_out IS NULL
    AND status <> 'Logged Out'
    AND date >= (p_shift_date - INTERVAL '2 days')::DATE
    AND check_in < (NOW() - INTERVAL '12 hours');

  RETURN QUERY SELECT
    v_active_workforce,
    v_active_breaks,
    v_idle_warnings,
    v_gps_alerts,
    v_mobile_sessions,
    v_auto_breaks,
    v_pending_disputes,
    v_stale_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Redefine recalculate_employee_lates_safe to fix aggregate FOR UPDATE syntax error
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
