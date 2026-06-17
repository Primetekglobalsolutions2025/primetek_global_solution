-- ====================================================================
-- Primetek Global Solutions - Atomic Rate Limiting Stored Procedure
-- ====================================================================

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_max_points INTEGER,
  p_duration_sec INTEGER,
  p_block_duration_sec INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_points INTEGER,
  ms_before_next INTEGER
) AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_record RECORD;
  v_expire_at TIMESTAMP WITH TIME ZONE;
  v_points INTEGER;
  v_ms_before_next INTEGER;
BEGIN
  -- Row locking via FOR UPDATE to prevent concurrency race conditions
  SELECT * INTO v_record FROM public.rate_limits WHERE key = p_key FOR UPDATE;
  
  IF NOT FOUND OR v_record.expire_at <= v_now THEN
    -- Reset / Initialize rate limit bucket
    v_expire_at := v_now + (p_duration_sec * INTERVAL '1 second');
    v_points := p_max_points - 1;
    
    INSERT INTO public.rate_limits (key, points, expire_at)
    VALUES (p_key, v_points, v_expire_at)
    ON CONFLICT (key) DO UPDATE
    SET points = EXCLUDED.points, expire_at = EXCLUDED.expire_at;
    
    RETURN QUERY SELECT TRUE, v_points, p_duration_sec * 1000;
  ELSE
    v_ms_before_next := EXTRACT(EPOCH FROM (v_record.expire_at - v_now)) * 1000;
    
    IF v_record.points <= 0 THEN
      -- If blocked, extend the lockout expiration
      IF p_block_duration_sec > 0 THEN
        v_expire_at := v_now + (p_block_duration_sec * INTERVAL '1 second');
        UPDATE public.rate_limits
        SET points = 0, expire_at = v_expire_at
        WHERE key = p_key;
        
        RETURN QUERY SELECT FALSE, 0, p_block_duration_sec * 1000;
      ELSE
        RETURN QUERY SELECT FALSE, 0, v_ms_before_next;
      END IF;
    ELSE
      -- Decrement points atomically
      v_points := v_record.points - 1;
      UPDATE public.rate_limits
      SET points = v_points
      WHERE key = p_key;
      
      RETURN QUERY SELECT TRUE, v_points, v_ms_before_next;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
