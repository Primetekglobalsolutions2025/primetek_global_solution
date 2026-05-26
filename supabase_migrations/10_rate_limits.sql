-- ==========================================
-- 10. Rate Limits Table Migration (Idempotent)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    points INTEGER NOT NULL,
    expire_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Admins / Service Role have full access to rate_limits
DROP POLICY IF EXISTS "Admins have full access to rate_limits" ON public.rate_limits;
CREATE POLICY "Admins have full access to rate_limits" 
  ON public.rate_limits FOR ALL USING (public.is_admin());
