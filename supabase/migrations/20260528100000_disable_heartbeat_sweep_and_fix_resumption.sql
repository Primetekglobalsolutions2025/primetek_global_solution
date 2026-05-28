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
