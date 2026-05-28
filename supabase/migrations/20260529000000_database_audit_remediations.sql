-- ============================================================
-- Primetek Global Solutions — Database Audit Remediation Migration
-- Date: May 29, 2026
-- ============================================================

-- 1. Redefine rebuild_attendance_projection to lock session and use ON CONFLICT DO UPDATE
-- This prevents race conditions and missing projection rows under concurrent telemetry inputs.
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
    -- A. Fetch employee ID and existing exemption states from master session and lock the master row to serialize updates
    SELECT employee_id, late_approved, permission_approved, shift_override, manager_exemption
    INTO v_emp_id, v_orig_late_approved, v_orig_permission_approved, v_orig_shift_override, v_orig_manager_exemption
    FROM public.attendance
    WHERE id = p_session_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session ID % not found.', p_session_id;
    END IF;

    -- B. Calculate time states from events stream
    SELECT * INTO v_calculated FROM public.get_session_state(p_session_id);

    -- C. Re-insert or update projection record (eliminating DELETE to prevent concurrency race conditions)
    INSERT INTO public.attendance_projections (
        session_id,
        employee_id,
        current_state,
        productive_seconds,
        break_seconds,
        last_heartbeat_at,
        session_version,
        device_type,
        device_label,
        updated_at
    ) VALUES (
        p_session_id,
        v_emp_id,
        v_calculated.current_state,
        v_calculated.total_productive_seconds,
        v_calculated.total_break_seconds,
        now(),
        1,
        v_calculated.device_type,
        v_calculated.device_label,
        now()
    )
    ON CONFLICT (session_id) DO UPDATE
    SET
        employee_id = EXCLUDED.employee_id,
        current_state = EXCLUDED.current_state,
        productive_seconds = EXCLUDED.productive_seconds,
        break_seconds = EXCLUDED.break_seconds,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at,
        session_version = public.attendance_projections.session_version + 1,
        device_type = EXCLUDED.device_type,
        device_label = EXCLUDED.device_label,
        updated_at = EXCLUDED.updated_at;

    -- D. Reset the master attendance cached fields, PRESERVING original database-level manual overrides/exemptions
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

    -- E. Replay all event overrides to restore status, check_out, and exemptions
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
            UPDATE public.attendance 
            SET 
                check_out = r.event_timestamp,
                duration_hours = ROUND((EXTRACT(EPOCH FROM (r.event_timestamp - check_in))::numeric / 3600.0), 2)
            WHERE id = p_session_id;
        ELSIF r.event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN', 'SESSION_RECOVERED') THEN
            UPDATE public.attendance 
            SET 
                check_out = NULL,
                duration_hours = NULL
            WHERE id = p_session_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Establish referential triggers for Polymorphic user deletion cascading
-- Cleans up active sessions, trusted devices, risk events, and audit logs when parents are deleted.

-- Employee Cleanup Trigger
CREATE OR REPLACE FUNCTION public.handle_employee_deletion_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.active_sessions WHERE user_id = OLD.id AND user_role = 'employee';
    DELETE FROM public.trusted_devices WHERE user_id = OLD.id;
    DELETE FROM public.attendance_risk_events WHERE employee_id = OLD.id;
    DELETE FROM public.audit_logs WHERE user_id = OLD.id AND user_role = 'employee';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_employee_deletion_cleanup ON public.employees;
CREATE TRIGGER tr_employee_deletion_cleanup
BEFORE DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.handle_employee_deletion_cleanup();

-- Admin Cleanup Trigger
CREATE OR REPLACE FUNCTION public.handle_admin_deletion_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.active_sessions WHERE user_id = OLD.id AND user_role = 'admin';
    DELETE FROM public.trusted_devices WHERE user_id = OLD.id;
    DELETE FROM public.audit_logs WHERE user_id = OLD.id AND user_role = 'admin';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_admin_deletion_cleanup ON public.admin_users;
CREATE TRIGGER tr_admin_deletion_cleanup
BEFORE DELETE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.handle_admin_deletion_cleanup();


-- 3. Add Foreign Key Constraints to partitioned attendance_events table
-- First, purge orphaned rows
DELETE FROM public.attendance_events
WHERE employee_id NOT IN (SELECT id FROM public.employees);

DELETE FROM public.attendance_events
WHERE session_id NOT IN (SELECT id FROM public.attendance);

-- Attach foreign keys
ALTER TABLE public.attendance_events DROP CONSTRAINT IF EXISTS fk_attendance_events_employee;
ALTER TABLE public.attendance_events
ADD CONSTRAINT fk_attendance_events_employee
FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.attendance_events DROP CONSTRAINT IF EXISTS fk_attendance_events_session;
ALTER TABLE public.attendance_events
ADD CONSTRAINT fk_attendance_events_session
FOREIGN KEY (session_id) REFERENCES public.attendance(id) ON DELETE CASCADE;


-- 4. Create Recommended Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_daily_metrics_employee_date ON public.profile_daily_metrics (employee_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_application_profiles_assigned_to ON public.application_profiles (assigned_to);
CREATE INDEX IF NOT EXISTS idx_applications_job_assigned ON public.applications (job_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_interview_requests_profile_employee ON public.interview_requests (profile_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_disputes_attendance_id ON public.disputes (attendance_id);


-- 5. Stale sessions sweeper for a single employee (eliminates N+1 loop in server actions)
CREATE OR REPLACE FUNCTION public.sweep_stale_sessions_for_employee(p_employee_id UUID, p_current_shift_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_stale RECORD;
    v_next_seq INT;
    v_closed_count INT := 0;
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
        WHERE a.employee_id = p_employee_id
          AND a.check_out IS NULL
          AND a.status IN ('Working', 'Idle', 'Break', 'Break (Auto)', 'Approved WFH', 'Pending WFH')
          AND a.date != p_current_shift_date
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

            -- Idempotency check: see if FORCE_LOGOUT event already registered
            IF EXISTS (
                SELECT 1 FROM public.attendance_events
                WHERE session_id = v_stale.id AND event_type = 'FORCE_LOGOUT'
            ) THEN
                CONTINUE;
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
            RAISE WARNING 'Failed to sweep session % for employee %: %', v_stale.id, p_employee_id, SQLERRM;
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'closed', v_closed_count,
        'errors', v_error_count,
        'swept_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Atomic candidate application and profile creation function
CREATE OR REPLACE FUNCTION public.create_full_application(
    p_job_id UUID,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_experience_years NUMERIC,
    p_assigned_to UUID,
    p_client_address TEXT,
    p_client_role TEXT,
    p_client_linkedin TEXT,
    p_role_category TEXT,
    p_education_details JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_app_id UUID;
BEGIN
    -- A. Insert into applications parent
    INSERT INTO public.applications (
        job_id,
        name,
        email,
        phone,
        experience_years,
        status,
        assigned_to
    ) VALUES (
        p_job_id,
        p_name,
        p_email,
        p_phone,
        p_experience_years,
        'pending',
        p_assigned_to
    )
    RETURNING id INTO v_app_id;

    -- B. Insert into application_profiles child
    INSERT INTO public.application_profiles (
        application_id,
        assigned_to,
        client_name,
        client_email,
        client_phone,
        client_address,
        client_role,
        client_linkedin,
        role_category,
        education_details,
        status
    ) VALUES (
        v_app_id,
        p_assigned_to,
        p_name,
        p_email,
        p_phone,
        p_client_address,
        p_client_role,
        p_client_linkedin,
        p_role_category,
        p_education_details,
        CASE WHEN p_assigned_to IS NOT NULL THEN 'assigned'::text ELSE 'processing'::text END
    );

    RETURN jsonb_build_object('success', true, 'application_id', v_app_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Atomic leave approval function (with locks and balance adjustments)
CREATE OR REPLACE FUNCTION public.approve_leave_request_atomic(p_request_id UUID, p_days INT)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_request_year INT;
    v_request_month INT;
    v_balance_id UUID;
BEGIN
    -- A. Fetch and lock the leave request
    SELECT * INTO v_request
    FROM public.leave_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Leave request not found');
    END IF;

    IF v_request.status != 'Pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Leave request is already processed');
    END IF;

    -- B. Update leave request status to Approved
    UPDATE public.leave_requests
    SET status = 'Approved', updated_at = now()
    WHERE id = p_request_id;

    -- C. Calculate year and month from start_date
    v_request_year := EXTRACT(YEAR FROM v_request.start_date)::INT;
    v_request_month := EXTRACT(MONTH FROM v_request.start_date)::INT;

    -- D. Check/Initialize leave balance record
    SELECT id INTO v_balance_id
    FROM public.leave_balances
    WHERE employee_id = v_request.employee_id
      AND year = v_request_year
      AND month = v_request_month
      AND leave_type = v_request.type
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.leave_balances (
            employee_id,
            leave_type,
            total_days,
            used_days,
            year,
            month
        ) VALUES (
            v_request.employee_id,
            v_request.type,
            CASE WHEN v_request.type = 'Casual' THEN 1 ELSE 0 END,
            0,
            v_request_year,
            v_request_month
        )
        RETURNING id INTO v_balance_id;
    END IF;

    -- E. Atomic increment of used_days
    UPDATE public.leave_balances
    SET used_days = used_days + p_days, updated_at = now()
    WHERE id = v_balance_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Atomic WFH status update function (appends override event and runs projection rebuilds)
CREATE OR REPLACE FUNCTION public.update_wfh_status_atomic(
    p_session_id UUID,
    p_status TEXT,
    p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_next_seq INT;
BEGIN
    -- A. Fetch and lock the attendance session
    SELECT * INTO v_request
    FROM public.attendance
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'WFH request not found');
    END IF;

    IF v_request.status != 'Pending WFH' THEN
        RETURN jsonb_build_object('success', false, 'error', 'WFH request has already been processed');
    END IF;

    -- B. Get next sequence number
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO v_next_seq
    FROM public.attendance_events
    WHERE session_id = p_session_id;

    -- C. Insert ADMIN_OVERRIDE event
    INSERT INTO public.attendance_events (
        session_id,
        employee_id,
        event_type,
        sequence_number,
        idempotency_key,
        client_ip,
        payload
    ) VALUES (
        p_session_id,
        v_request.employee_id,
        'ADMIN_OVERRIDE',
        v_next_seq,
        'override-' || p_session_id::text || '-status-' || p_status || '-' || v_next_seq::text,
        '0.0.0.0',
        jsonb_build_object(
            'override_field', 'status',
            'old_value', v_request.status,
            'new_value', p_status,
            'reason', 'WFH request approval decision to ' || p_status,
            'admin_id', p_admin_id
        )
    );

    -- D. Rebuild projection
    PERFORM public.rebuild_attendance_projection(p_session_id);

    -- E. Recalculate employee lates for the month of this record
    IF v_request.date IS NOT NULL THEN
        PERFORM public.recalculate_employee_lates_safe(
            v_request.employee_id,
            EXTRACT(YEAR FROM v_request.date)::INT,
            EXTRACT(MONTH FROM v_request.date)::INT
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
