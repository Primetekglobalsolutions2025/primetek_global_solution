-- ====================================================================
-- Migration: Fix WFH Heartbeat Tracking and Auto Clock-Out Resumption
-- Purpose: Ensures Approved WFH sessions are evaluated correctly for heartbeats
--          and can be recovered / resumed bypassing 15-minute restrictions.
--          Restores duration_hours for closed sessions and excludes break
--          sessions from heartbeat staleness sweep timeout.
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
