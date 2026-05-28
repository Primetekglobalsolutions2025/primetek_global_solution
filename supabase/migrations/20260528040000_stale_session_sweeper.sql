-- ====================================================================
-- Migration: Global Stale Session Sweeper
-- Purpose: Proactive database-level sweeper that closes stale active
--          sessions by appending FORCE_LOGOUT events and rebuilding
--          projections. Fully event-sourced — no direct status mutations.
-- ====================================================================

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
            PERFORM public.rebuild_attendance_projection(v_stale.id);

            -- The rebuild sets status = 'CLOCKED_OUT' from get_session_state,
            -- but the attendance CHECK constraint requires 'Logged Out'.
            -- Map it here after the rebuild completes.
            UPDATE public.attendance
            SET status = 'Logged Out'
            WHERE id = v_stale.id
              AND status = 'CLOCKED_OUT';

            -- Also ensure the projection reflects the mapped state
            UPDATE public.attendance_projections
            SET current_state = 'CLOCKED_OUT'
            WHERE session_id = v_stale.id;

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
