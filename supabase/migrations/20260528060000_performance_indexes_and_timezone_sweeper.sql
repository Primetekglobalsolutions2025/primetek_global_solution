-- ====================================================================
-- Migration: Query performance indexes and timezone-safe sweeper
-- Purpose: Adds indexing for session/event lookups and adjusts the system
--          sweeper to be timezone-agnostic and tolerant of throttled background tabs.
-- ====================================================================

-- 1. Create Recommended Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_events_session_sequence_v2
ON public.attendance_events (session_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_status_v2
ON public.attendance (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_projections_employee_v2
ON public.attendance_projections (employee_id);

-- 2. Redefine sweep_and_close_stale_sessions function with explicit timezone casts and 30-minute grace window
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
              -- Condition 1: Heartbeat stale (>30 minutes to absorb background tab browser throttling)
              (p.last_heartbeat_at IS NOT NULL AND p.last_heartbeat_at < (v_now - INTERVAL '30 minutes'))
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
