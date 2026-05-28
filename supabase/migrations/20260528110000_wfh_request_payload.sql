-- Redefine get_session_state to correctly map active state to 'Approved WFH' or 'Pending WFH' using is_wfh_request event payload flag
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
    v_is_wfh_request BOOLEAN := FALSE;
BEGIN
    -- Check if session has Approved WFH override in its history or is pending WFH
    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events 
        WHERE session_id = p_session_id 
          AND event_type = 'ADMIN_OVERRIDE' 
          AND (payload->>'override_field') = 'status' 
          AND (payload->>'new_value') = 'Approved WFH'
    ) INTO v_is_wfh;

    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events 
        WHERE session_id = p_session_id 
          AND event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN') 
          AND (payload->>'is_wfh_request')::boolean = true
    ) INTO v_is_wfh_request;

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
                ELSIF v_is_wfh_request THEN
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


-- Redefine apply_event_to_projection to support WFH status tracking and Pending WFH initialization
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
    v_is_wfh_request BOOLEAN := FALSE;
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

    -- Check if session has Approved WFH override in its history or is pending WFH
    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events 
        WHERE session_id = NEW.session_id 
          AND event_type = 'ADMIN_OVERRIDE' 
          AND (payload->>'override_field') = 'status' 
          AND (payload->>'new_value') = 'Approved WFH'
    ) INTO v_is_wfh;

    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events 
        WHERE session_id = NEW.session_id 
          AND event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN') 
          AND (payload->>'is_wfh_request')::boolean = true
    ) INTO v_is_wfh_request;

    -- If projection does not exist, initialize it
    IF NOT FOUND THEN
        IF NEW.event_type IN ('CLOCK_IN', 'MOBILE_CLOCK_IN') THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version, device_type, device_label
            ) VALUES (
                NEW.session_id, NEW.employee_id, 
                CASE 
                    WHEN v_is_wfh THEN 'Approved WFH'::varchar 
                    WHEN v_is_wfh_request THEN 'Pending WFH'::varchar
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
            ELSIF v_is_wfh_request THEN
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
