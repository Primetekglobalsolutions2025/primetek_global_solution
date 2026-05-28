-- ====================================================================
-- Migration: Simplification and Stabilization of Attendance Logic
-- Purpose: Simplifies the event states and standardized check constraints
--          to focus only on: Working, Idle, Break, Break (Auto), Logged Out.
-- ====================================================================

-- 1. Alter attendance table to add active device identification and update status constraint
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS active_device_fingerprint VARCHAR(256);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS active_tab_id VARCHAR(256);

-- Drop the old constraint
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Map existing status values to standard forms to avoid constraint violations
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
    ELSE status
END;

-- Fallback for any unmatched values to avoid constraint failure
UPDATE public.attendance
SET status = 'Logged Out'
WHERE status NOT IN (
    'Working', 'Idle', 'Break', 'Break (Auto)', 'Logged Out',
    'Pending WFH', 'Approved WFH', 'Rejected WFH', 
    'Present', 'Late', 'Absent', 'Half-day'
);

-- Recreate constraint with the simplified states (preserving leaves/WFH for compatibility)
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
    CHECK (status IN (
        'Working', 'Idle', 'Break', 'Break (Auto)', 'Logged Out',
        'Pending WFH', 'Approved WFH', 'Rejected WFH', 
        'Present', 'Late', 'Absent', 'Half-day'
    ));

-- 2. Redefine get_session_state helper function to output standardized states
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
            WHEN 'CLOCK_IN', 'MOBILE_CLOCK_IN', 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED', 'GPS_REENTRY', 'BREAK_ENDED' THEN
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

    RETURN QUERY SELECT v_state, v_prod_sec, v_break_sec, v_last_gps, (v_state != 'Logged Out'), v_device_type, v_device_label;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Redefine apply_event_to_projection trigger function to output standard states
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

    -- Fetch the last processed state and timestamp of the projection
    SELECT current_state, last_heartbeat_at 
    INTO v_state_val, v_last_time
    FROM public.attendance_projections
    WHERE session_id = NEW.session_id
    FOR UPDATE;

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

    -- Update state mapping based on new event
    CASE NEW.event_type
        WHEN 'CLOCK_IN', 'MOBILE_CLOCK_IN', 'DESKTOP_SESSION_VERIFIED', 'PRODUCTIVE_TIMER_RESUMED', 'GPS_REENTRY', 'BREAK_ENDED' THEN
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

-- 4. Redefine rebuild_attendance_projection to match standardized states
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

-- 5. Redefine sweep_and_close_stale_sessions function with simplified parameters
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
          AND a.status IN ('Working', 'Idle', 'Break', 'Break (Auto)')
          AND (
              -- Condition 1: Heartbeat stale (>15 minutes since last heartbeat)
              (p.last_heartbeat_at IS NOT NULL AND p.last_heartbeat_at < (v_now - INTERVAL '15 minutes'))
              -- Condition 2: Allowed shift duration exceeded (9 hours)
              OR (a.check_in IS NOT NULL AND a.check_in < (v_now - INTERVAL '9 hours'))
              -- Condition 3: Crossed the shift boundary cutoff (4:30 AM IST / 23:00 UTC of shift date)
              OR (a.date IS NOT NULL AND v_now > (a.date + TIME '23:00:00'))
          )
        FOR UPDATE OF a SKIP LOCKED
    LOOP
        BEGIN
            -- Determine stale reason
            IF v_stale.check_in IS NOT NULL AND v_stale.check_in < (v_now - INTERVAL '9 hours') THEN
                v_stale_reason := 'shift_duration_exceeded';
                v_stale_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_stale.check_in))::INT;
            ELSIF v_stale.date IS NOT NULL AND v_now > (v_stale.date + TIME '23:00:00') THEN
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
                v_auto_checkout := v_stale.date + TIME '23:00:00';
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

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.sweep_and_close_stale_sessions() TO service_role;
