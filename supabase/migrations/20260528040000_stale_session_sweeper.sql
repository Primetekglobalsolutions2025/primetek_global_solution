-- ====================================================================
-- Migration: Global Stale Session Sweeper & Projection Fix
-- Purpose: Proactive database-level sweeper that closes stale active
--          sessions by appending FORCE_LOGOUT events and rebuilding
--          projections. Corrects check constraint mapping for status.
-- ====================================================================

-- 1. Redefine apply_event_to_projection trigger function to map event-source status values safely
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

    -- Also cache on public.attendance (Mapping logic to fit attendance_status_check constraint)
    UPDATE public.attendance
    SET
        status = CASE v_state_val
            WHEN 'ACTIVE' THEN 'Working'
            WHEN 'ON_BREAK' THEN 'On Break'
            WHEN 'AUTO_BREAK' THEN 'On Break'
            WHEN 'CLOCKED_OUT' THEN 'Logged Out'
            WHEN 'OFFLINE' THEN 'Logged Out'
            ELSE v_state_val
        END,
        device_type = COALESCE((NEW.payload->>'device_type')::varchar, device_type),
        device_label = COALESCE((NEW.payload->>'device_label')::varchar, device_label)
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine rebuild_attendance_projection function to map event-source status values safely
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

    -- 5. Reset the master attendance cached fields that can be modified by overrides (Mapping status safely)
    UPDATE public.attendance
    SET 
        status = CASE v_calculated.current_state
            WHEN 'ACTIVE' THEN 'Working'
            WHEN 'ON_BREAK' THEN 'On Break'
            WHEN 'AUTO_BREAK' THEN 'On Break'
            WHEN 'CLOCKED_OUT' THEN 'Logged Out'
            WHEN 'OFFLINE' THEN 'Logged Out'
            ELSE v_calculated.current_state
        END,
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

-- 3. Create or replace sweep_and_close_stale_sessions function using the corrected projection helpers
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
    -- Iterate over all sessions that are currently "active" but stale.
    -- Uses FOR UPDATE SKIP LOCKED to prevent concurrent sweeper conflicts.
    FOR v_stale IN
        SELECT a.id, a.employee_id, a.date, a.check_in, a.status, a.awaiting_desktop_deadline,
               p.last_heartbeat_at
        FROM public.attendance a
        LEFT JOIN public.attendance_projections p ON p.session_id = a.id
        WHERE a.check_out IS NULL
          AND a.status IN (
              'Working', 'On Break', 'ACTIVE', 'DESKTOP_ACTIVE',
              'AWAITING_DESKTOP', 'PRODUCTIVE_TIMER_PAUSED',
              'Approved WFH', 'MOBILE_CLOCKED_IN'
          )
          AND (
              -- Condition 1: Heartbeat stale (>15 minutes since last heartbeat)
              (p.last_heartbeat_at IS NOT NULL AND p.last_heartbeat_at < (v_now - INTERVAL '15 minutes'))
              -- Condition 2: Session exceeds 16-hour maximum duration
              OR (a.check_in IS NOT NULL AND a.check_in < (v_now - INTERVAL '16 hours'))
              -- Condition 3: Awaiting desktop grace expired
              OR (a.awaiting_desktop_deadline IS NOT NULL AND a.awaiting_desktop_deadline < v_now AND a.status = 'AWAITING_DESKTOP')
              -- Condition 4: Crossed the shift boundary cutoff (4:30 AM IST / 23:00 UTC of shift date)
              OR (a.date IS NOT NULL AND v_now > (a.date + TIME '23:00:00'))
          )
        FOR UPDATE OF a SKIP LOCKED
    LOOP
        BEGIN
            -- Determine stale reason
            IF v_stale.check_in IS NOT NULL AND v_stale.check_in < (v_now - INTERVAL '16 hours') THEN
                v_stale_reason := 'session_exceeded_16h';
                v_stale_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_stale.check_in))::INT;
            ELSIF v_stale.status = 'AWAITING_DESKTOP' AND v_stale.awaiting_desktop_deadline IS NOT NULL AND v_stale.awaiting_desktop_deadline < v_now THEN
                v_stale_reason := 'desktop_grace_expired';
                v_stale_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_stale.awaiting_desktop_deadline))::INT;
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

            -- Calculate auto check-out time:
            -- For 16h sessions: check_in + 9 hours (standard shift)
            -- For grace expired: awaiting_desktop_deadline
            -- For crossed shift boundary: 4:30 AM IST of next day (23:00 UTC of shift date)
            -- For heartbeat timeout: last_heartbeat_at
            IF v_stale_reason = 'session_exceeded_16h' THEN
                v_auto_checkout := v_stale.check_in + INTERVAL '9 hours';
            ELSIF v_stale_reason = 'desktop_grace_expired' THEN
                v_auto_checkout := v_stale.awaiting_desktop_deadline;
            ELSIF v_stale_reason = 'cross_shift_boundary' THEN
                v_auto_checkout := v_stale.date + TIME '23:00:00';
            ELSIF v_stale.last_heartbeat_at IS NOT NULL THEN
                v_auto_checkout := v_stale.last_heartbeat_at;
            ELSE
                v_auto_checkout := v_now;
            END IF;

            -- Get next sequence number for the event stream
            SELECT COALESCE(MAX(sequence_number), 0) + 1
            INTO v_next_seq
            FROM public.attendance_events
            WHERE session_id = v_stale.id;

            -- Append FORCE_LOGOUT event (event-sourced, immutable)
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
                    'original_status', v_stale.status,
                    'swept_at', v_now
                )
            );

            -- Rebuild projection from event stream (this replays all events)
            -- The mapping inside rebuild_attendance_projection sets status correctly on public.attendance
            PERFORM public.rebuild_attendance_projection(v_stale.id);

            v_closed_count := v_closed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Log but don't fail the entire sweep for one bad session
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
