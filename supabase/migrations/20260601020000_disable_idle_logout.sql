-- Redefine sweep_active_sessions_telemetry to disable inactivity-based automatic logout
-- Employees will transition to Idle (after 3 minutes) and Break (Auto) (after 5 minutes),
-- but will NOT be logged out (FORCE_LOGOUT) during the active shift.

CREATE OR REPLACE FUNCTION public.sweep_active_sessions_telemetry()
RETURNS JSONB AS $$
DECLARE
    v_stale RECORD;
    v_next_seq INT;
    v_now TIMESTAMPTZ := now();
    v_idle_threshold INT := 300;      -- 5 minutes
    v_autobreak_threshold INT := 420;  -- 7 minutes
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

        -- Transition logic: transition to Idle after 3 min, Break (Auto) after 5 min
        -- No automatic force logout during the active shift (removed the 15-minute logout rule)
        IF v_stale.current_state IN ('Working', 'Approved WFH') AND v_diff >= v_idle_threshold AND v_diff < v_autobreak_threshold THEN
            v_new_state := 'Idle';
            v_event_type := 'IDLE_DETECTED';
        ELSIF v_stale.current_state IN ('Working', 'Approved WFH', 'Idle') AND v_diff >= v_autobreak_threshold THEN
            v_new_state := 'Break (Auto)';
            v_event_type := 'AUTO_BREAK_TRIGGERED';
        END IF;

        IF v_new_state IS NOT NULL THEN
            -- Get next sequence number
            SELECT COALESCE(MAX(sequence_number), 0) + 1
            INTO v_next_seq
            FROM public.attendance_events
            WHERE session_id = v_stale.id;

            -- Insert transition event
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
                v_now,
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
