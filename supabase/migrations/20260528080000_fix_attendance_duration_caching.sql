-- ====================================================================
-- Migration: Fix Attendance Duration Caching & Rebuild Mapping
-- Purpose: Ensures productive_hours, total_break_seconds, and
--          current_break_start are cached in the master public.attendance
--          table whenever events are inserted or projections rebuilt.
-- ====================================================================

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
