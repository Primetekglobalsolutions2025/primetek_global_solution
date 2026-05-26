-- ==========================================
-- 09. Daily Reports and Interview Requests Migration (Idempotent)
-- ==========================================

-- 1. Create profile_daily_metrics table if not exists
CREATE TABLE IF NOT EXISTS public.profile_daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.application_profiles(id) ON DELETE CASCADE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Cumulative metrics
    applications_count INTEGER NOT NULL DEFAULT 0,
    interviews_count INTEGER NOT NULL DEFAULT 0,
    assessments INTEGER NOT NULL DEFAULT 0,
    technical_rounds INTEGER NOT NULL DEFAULT 0,
    non_technical INTEGER NOT NULL DEFAULT 0,
    self_submissions INTEGER NOT NULL DEFAULT 0,
    support_submissions INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(profile_id, report_date)
);

-- Enable RLS on profile_daily_metrics
ALTER TABLE public.profile_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to profile_daily_metrics" ON public.profile_daily_metrics;
CREATE POLICY "Admins have full access to profile_daily_metrics" 
  ON public.profile_daily_metrics FOR ALL USING (public.is_admin());

-- Create modtime trigger for profile_daily_metrics
DROP TRIGGER IF EXISTS update_profile_daily_metrics_modtime ON public.profile_daily_metrics;
CREATE TRIGGER update_profile_daily_metrics_modtime
    BEFORE UPDATE ON public.profile_daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();


-- 2. Create interview_requests table if not exists
CREATE TABLE IF NOT EXISTS public.interview_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.application_profiles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    
    -- Pre-filled from profile
    consultant_name TEXT NOT NULL,
    consultant_phone TEXT,
    consultant_technology TEXT,
    
    -- Filled by employee
    client_company TEXT NOT NULL,
    interview_datetime TIMESTAMPTZ NOT NULL,
    interview_platform TEXT NOT NULL,
    
    -- Resume
    resume_type TEXT NOT NULL DEFAULT 'original' CHECK (resume_type IN ('original', 'updated')),
    updated_resume_url TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'cancelled')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on interview_requests
ALTER TABLE public.interview_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to interview_requests" ON public.interview_requests;
CREATE POLICY "Admins have full access to interview_requests" 
  ON public.interview_requests FOR ALL USING (public.is_admin());

-- Create modtime trigger for interview_requests
DROP TRIGGER IF EXISTS update_interview_requests_modtime ON public.interview_requests;
CREATE TRIGGER update_interview_requests_modtime
    BEFORE UPDATE ON public.interview_requests
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();


-- 3. Update default casual leave configuration to 1 (previously 10)
INSERT INTO public.portal_config (config_key, config_value, description)
VALUES ('default_casual_leave', '1', 'Default monthly casual leave credits for new employees')
ON CONFLICT (config_key) DO UPDATE SET config_value = '1';

-- Update all existing casual leave balances to total_days = 1
UPDATE public.leave_balances 
SET total_days = 1 
WHERE leave_type = 'Casual';


-- 4. Update leave_requests and leave_balances constraints to support Unpaid Leave
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_type_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_type_check
CHECK (type IN ('Casual', 'Unpaid'));

ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('Casual', 'Unpaid'));
