-- Migration: Telemetry Sweeper direct logout after shift end (3:30 AM IST)
-- Date: June 1, 2026

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
    v_shift_end TIMESTAMPTZ;
    v_is_after_shift_end BOOLEAN;
BEGIN
    -- Find checked-in sessions that are active (not logged out)
    FOR v_stale IN
        SELECT a.id, a.employee_id, a.status, a.current_break_start, a.lat, a.lng, a.check_in, a.date,
               p.last_heartbeat_at, p.current_state
        FROM public.attendance a
        JOIN public.attendance_projections p ON p.session_id = a.id
        WHERE a.check_out IS NULL
          AND p.current_state <> 'Logged Out'
        FOR UPDATE OF a
    LOOP
        v_diff := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stale.last_heartbeat_at, v_stale.check_in)))::INT;
        v_new_state := NULL;

        -- Shift end is 3:30 AM IST of the next calendar day (which corresponds to 22:00:00 UTC of the shift date)
        v_shift_end := (v_stale.date + TIME '22:00:00') AT TIME ZONE 'UTC';
        v_is_after_shift_end := v_now > v_shift_end;

        -- Transition logic
        IF v_is_after_shift_end THEN
            -- Past 3:30 AM IST: directly clock out if inactive for 5 minutes (300 seconds)
            IF v_diff >= 300 THEN
                v_new_state := 'Logged Out';
                v_event_type := 'FORCE_LOGOUT';
            END IF;
        ELSE
            -- Normal transition logic for current shift
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
                CASE WHEN v_new_state = 'Logged Out' THEN COALESCE(v_stale.last_heartbeat_at, v_stale.check_in) ELSE v_now END,
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
