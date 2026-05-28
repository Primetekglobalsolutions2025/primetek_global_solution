-- ====================================================================
-- Migration: Desktop Session Validation & Mobile Clock-in Guard
-- ====================================================================

-- 1. Add new values to attendance_event_type enum
-- Since ALTER TYPE ADD VALUE cannot run inside transactional DO blocks, we run them as plain SQL statements.
ALTER TYPE public.attendance_event_type ADD VALUE 'MOBILE_CLOCK_IN';
ALTER TYPE public.attendance_event_type ADD VALUE 'DESKTOP_SESSION_VERIFIED';
ALTER TYPE public.attendance_event_type ADD VALUE 'DESKTOP_SESSION_MISSING';
ALTER TYPE public.attendance_event_type ADD VALUE 'PRODUCTIVE_TIMER_PAUSED';
ALTER TYPE public.attendance_event_type ADD VALUE 'PRODUCTIVE_TIMER_RESUMED';

-- 2. Add columns to attendance and attendance_projections tables
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS awaiting_desktop_deadline TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS device_type VARCHAR(32);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS device_label VARCHAR(256);

ALTER TABLE public.attendance_projections ADD COLUMN IF NOT EXISTS device_type VARCHAR(32);
ALTER TABLE public.attendance_projections ADD COLUMN IF NOT EXISTS device_label VARCHAR(256);

-- 3. Update the attendance status constraint to include the new states
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
    CHECK (status IN (
        'Present', 'Late', 'Absent', 'Half-day', 
        'Pending WFH', 'Approved WFH', 'Rejected WFH', 
        'Working', 'On Break', 'Logged Out',
        'MOBILE_CLOCKED_IN', 'AWAITING_DESKTOP', 'DESKTOP_ACTIVE', 'PRODUCTIVE_TIMER_PAUSED'
    ));

-- 4. Re-create apply_event_to_projection trigger function
CREATE OR REPLACE FUNCTION public.apply_event_to_projection()
RETURNS TRIGGER AS $$
DECLARE
    v_prod_delta INT := 0;
    v_break_delta INT := 0;
    v_last_time TIMESTAMPTZ;
    v_state_val VARCHAR;
    v_desktop_verified BOOLEAN := false;
    v_grace_expired BOOLEAN := false;
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

    -- Fetch the last processed state and timestamp of the projection
    SELECT current_state, last_heartbeat_at 
    INTO v_state_val, v_last_time
    FROM public.attendance_projections
    WHERE session_id = NEW.session_id
    FOR UPDATE;

    -- If projection does not exist, initialize it (only on CLOCK_IN or MOBILE_CLOCK_IN event)
    IF NOT FOUND THEN
        IF NEW.event_type = 'CLOCK_IN' THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version, device_type, device_label
            ) VALUES (
                NEW.session_id, NEW.employee_id, 'ACTIVE', NEW.event_timestamp, true, 1, 
                COALESCE((NEW.payload->>'device_type')::varchar, 'desktop'),
                COALESCE((NEW.payload->>'device_label')::varchar, 'Desktop')
            );
        ELSIF NEW.event_type = 'MOBILE_CLOCK_IN' THEN
            INSERT INTO public.attendance_projections (
                session_id, employee_id, current_state, last_heartbeat_at, last_geofence_status, session_version, device_type, device_label
            ) VALUES (
                NEW.session_id, NEW.employee_id, 'AWAITING_DESKTOP', NEW.event_timestamp, true, 1,
                COALESCE((NEW.payload->>'device_type')::varchar, 'mobile'),
                COALESCE((NEW.payload->>'device_label')::varchar, 'Mobile')
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Calculate delta timing based on state transition
    IF v_state_val IN ('ACTIVE', 'MOBILE_CLOCKED_IN', 'AWAITING_DESKTOP', 'DESKTOP_ACTIVE') THEN
        v_prod_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    ELSIF v_state_val IN ('ON_BREAK', 'AUTO_BREAK') THEN
        v_break_delta := EXTRACT(EPOCH FROM (NEW.event_timestamp - v_last_time))::INT;
    END IF;

    -- Fetch event history helpers to resolve break ends and GPS reentries correctly
    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events
        WHERE session_id = NEW.session_id AND event_type = 'DESKTOP_SESSION_VERIFIED'
    ) INTO v_desktop_verified;

    SELECT EXISTS (
        SELECT 1 FROM public.attendance_events
        WHERE session_id = NEW.session_id AND event_type = 'DESKTOP_SESSION_MISSING'
    ) INTO v_grace_expired;

    -- Update state mapping based on new event
    CASE NEW.event_type
        WHEN 'BREAK_STARTED' THEN v_state_val := 'ON_BREAK';
        WHEN 'AUTO_BREAK_TRIGGERED' THEN v_state_val := 'AUTO_BREAK';
        WHEN 'BREAK_ENDED', 'GPS_REENTRY' THEN
            IF v_desktop_verified THEN
                v_state_val := 'DESKTOP_ACTIVE';
            ELSIF v_grace_expired THEN
                v_state_val := 'PRODUCTIVE_TIMER_PAUSED';
            ELSE
                -- Check if we clocked in from mobile
                IF EXISTS (
                    SELECT 1 FROM public.attendance_events
                    WHERE session_id = NEW.session_id AND event_type = 'MOBILE_CLOCK_IN'
                ) THEN
                    v_state_val := 'AWAITING_DESKTOP';
                ELSE
                    v_state_val := 'ACTIVE';
                END IF;
            END IF;
        WHEN 'GPS_EXIT' THEN v_state_val := 'GEO_OUTSIDE';
        WHEN 'CLOCK_OUT', 'FORCE_LOGOUT' THEN v_state_val := 'CLOCKED_OUT';
        WHEN 'MOBILE_CLOCK_IN' THEN v_state_val := 'AWAITING_DESKTOP';
        WHEN 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED' THEN v_state_val := 'DESKTOP_ACTIVE';
        WHEN 'DESKTOP_SESSION_MISSING', 'PRODUCTIVE_TIMER_PAUSED' THEN v_state_val := 'PRODUCTIVE_TIMER_PAUSED';
        ELSE
            -- Keep current state for telemetry events
    END CASE;

    -- Update the projection cache
    UPDATE public.attendance_projections
    SET
        current_state = v_state_val,
        productive_seconds = productive_seconds + COALESCE(v_prod_delta, 0),
        break_seconds = break_seconds + COALESCE(v_break_delta, 0),
        last_heartbeat_at = NEW.event_timestamp,
        session_version = session_version + 1,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label),
        updated_at = now()
    WHERE session_id = NEW.session_id;

    -- Also cache on public.attendance
    UPDATE public.attendance
    SET
        status = v_state_val,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label)
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-create get_session_state function to process device columns and new event types
DROP FUNCTION IF EXISTS public.get_session_state(UUID);
CREATE OR REPLACE FUNCTION public.get_session_state(p_session_id UUID)
RETURNS TABLE (
    current_state VARCHAR,
    total_productive_seconds INT,
    total_break_seconds INT,
    last_known_gps POINT,
    is_active BOOLEAN,
    device_type VARCHAR,
    device_label VARCHAR
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
    v_desktop_verified BOOLEAN := false;
    v_grace_expired BOOLEAN := false;
    v_is_mobile_clock_in BOOLEAN := false;
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

        -- Extract device info if present in payload
        IF r.payload ? 'device_type' THEN
            v_device_type := (r.payload->>'device_type')::varchar;
            v_device_label := (r.payload->>'device_label')::varchar;
        END IF;

        CASE r.event_type
            WHEN 'CLOCK_IN' THEN
                v_state := 'ACTIVE';
                v_work_start := r.event_timestamp;
            WHEN 'MOBILE_CLOCK_IN' THEN
                v_state := 'AWAITING_DESKTOP';
                v_work_start := r.event_timestamp;
                v_is_mobile_clock_in := true;
            WHEN 'DESKTOP_SESSION_VERIFIED' THEN
                v_desktop_verified := true;
                IF v_state = 'PRODUCTIVE_TIMER_PAUSED' THEN
                    v_work_start := r.event_timestamp;
                END IF;
                v_state := 'DESKTOP_ACTIVE';
            WHEN 'DESKTOP_SESSION_MISSING', 'PRODUCTIVE_TIMER_PAUSED' THEN
                v_grace_expired := true;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;
                v_state := 'PRODUCTIVE_TIMER_PAUSED';
            WHEN 'PRODUCTIVE_TIMER_RESUMED' THEN
                IF v_state = 'PRODUCTIVE_TIMER_PAUSED' THEN
                    v_work_start := r.event_timestamp;
                END IF;
                v_state := CASE WHEN v_desktop_verified THEN 'DESKTOP_ACTIVE' ELSE 'ACTIVE' END;
            WHEN 'BREAK_STARTED', 'AUTO_BREAK_TRIGGERED' THEN
                v_state := CASE WHEN r.event_type = 'AUTO_BREAK_TRIGGERED' THEN 'AUTO_BREAK' ELSE 'ON_BREAK' END;
                v_break_start := r.event_timestamp;
                IF v_work_start IS NOT NULL THEN
                    v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (r.event_timestamp - v_work_start))::INT;
                    v_work_start := NULL;
                END IF;
            WHEN 'BREAK_ENDED' THEN
                -- Resume tracking
                IF v_desktop_verified THEN
                    v_state := 'DESKTOP_ACTIVE';
                ELSIF v_grace_expired THEN
                    v_state := 'PRODUCTIVE_TIMER_PAUSED';
                ELSE
                    IF v_is_mobile_clock_in THEN
                         v_state := 'AWAITING_DESKTOP';
                    ELSE
                         v_state := 'ACTIVE';
                    END IF;
                END IF;
                
                IF v_state != 'PRODUCTIVE_TIMER_PAUSED' THEN
                    v_work_start := r.event_timestamp;
                END IF;
                
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
                -- Keep current state for telemetry events
        END CASE;
    END LOOP;

    -- Handle ongoing time if session is still active
    IF v_state IN ('ACTIVE', 'MOBILE_CLOCKED_IN', 'AWAITING_DESKTOP', 'DESKTOP_ACTIVE') AND v_work_start IS NOT NULL THEN
        v_prod_sec := v_prod_sec + EXTRACT(EPOCH FROM (now() - v_work_start))::INT;
    ELSIF (v_state = 'ON_BREAK' OR v_state = 'AUTO_BREAK') AND v_break_start IS NOT NULL THEN
        v_break_sec := v_break_sec + EXTRACT(EPOCH FROM (now() - v_break_start))::INT;
    END IF;

    RETURN QUERY SELECT v_state, v_prod_sec, v_break_sec, v_last_gps, (v_state != 'CLOCKED_OUT'), v_device_type, v_device_label;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. Re-create rebuild_attendance_projection function to process device columns
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

    -- 5. Reset the master attendance cached fields that can be modified by overrides
    UPDATE public.attendance
    SET 
        status = v_calculated.current_state,
        check_out = NULL,
        late_approved = false,
        permission_approved = false,
        shift_override = false,
        manager_exemption = false,
        device_type = v_calculated.device_type,
        device_label = v_calculated.device_label
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
