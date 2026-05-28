-- Create a unified function to fetch realtime attendance metrics in one query
CREATE OR REPLACE FUNCTION public.get_realtime_attendance_metrics(
  p_shift_date DATE,
  p_shift_start_utc TIMESTAMPTZ
)
RETURNS TABLE (
  active_workforce BIGINT,
  active_breaks BIGINT,
  idle_warnings BIGINT,
  gps_alerts BIGINT,
  mobile_sessions BIGINT,
  auto_breaks BIGINT,
  pending_disputes BIGINT,
  stale_sessions BIGINT
) AS $$
DECLARE
  v_active_workforce BIGINT;
  v_active_breaks BIGINT;
  v_idle_warnings BIGINT;
  v_gps_alerts BIGINT;
  v_mobile_sessions BIGINT;
  v_auto_breaks BIGINT;
  v_pending_disputes BIGINT;
  v_stale_sessions BIGINT;
BEGIN
  -- 1. active_workforce
  SELECT COUNT(*) INTO v_active_workforce
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND status IN ('Working', 'Idle');

  -- 2. active_breaks
  SELECT COUNT(*) INTO v_active_breaks
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND status IN ('Break', 'Break (Auto)');

  -- 3. idle_warnings
  SELECT COUNT(*) INTO v_idle_warnings
  FROM public.attendance
  WHERE date = p_shift_date
    AND status = 'Idle';

  -- 4. gps_alerts
  SELECT COUNT(*) INTO v_gps_alerts
  FROM public.attendance_events
  WHERE event_type = 'GPS_EXIT'
    AND event_timestamp >= p_shift_start_utc;

  -- 5. mobile_sessions
  SELECT COUNT(*) INTO v_mobile_sessions
  FROM public.attendance
  WHERE date = p_shift_date
    AND check_out IS NULL
    AND device_type = 'mobile';

  -- 6. auto_breaks
  SELECT COUNT(*) INTO v_auto_breaks
  FROM public.attendance_events
  WHERE event_type = 'AUTO_BREAK_TRIGGERED'
    AND event_timestamp >= p_shift_start_utc;

  -- 7. pending_disputes
  SELECT COUNT(*) INTO v_pending_disputes
  FROM public.disputes
  WHERE status = 'PENDING';

  -- 8. stale_sessions: check_in older than 12 hours, check_out is null, status is not 'Logged Out'
  SELECT COUNT(*) INTO v_stale_sessions
  FROM public.attendance
  WHERE check_out IS NULL
    AND status <> 'Logged Out'
    AND date >= (p_shift_date - INTERVAL '2 days')::DATE
    AND check_in < (NOW() - INTERVAL '12 hours');

  RETURN QUERY SELECT
    v_active_workforce,
    v_active_breaks,
    v_idle_warnings,
    v_gps_alerts,
    v_mobile_sessions,
    v_auto_breaks,
    v_pending_disputes,
    v_stale_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
