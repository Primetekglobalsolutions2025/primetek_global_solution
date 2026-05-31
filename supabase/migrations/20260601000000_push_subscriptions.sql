-- ====================================================================
-- Primetek Global Solutions - Push Notifications & Subscriptions Schema
-- ====================================================================

-- 1. Create Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_name TEXT,
    browser_type TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT push_sub_user_check CHECK (
        (employee_id IS NOT NULL AND admin_id IS NULL) OR
        (employee_id IS NULL AND admin_id IS NOT NULL)
    )
);

-- Trigger to automatically update modified timestamp
DROP TRIGGER IF EXISTS update_push_subscriptions_modtime ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_modtime
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee_id ON public.push_subscriptions(employee_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_admin_id ON public.push_subscriptions(admin_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON public.push_subscriptions(is_active);

-- Enable RLS on Push Subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies for Push Subscriptions
DROP POLICY IF EXISTS "Admins have full access to push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins have full access to push_subscriptions" ON public.push_subscriptions 
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Employees can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Employees can manage their own subscriptions" ON public.push_subscriptions
    FOR ALL USING (
        employee_id = auth.uid()
    ) WITH CHECK (
        employee_id = auth.uid()
    );

DROP POLICY IF EXISTS "Admins can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can manage their own subscriptions" ON public.push_subscriptions
    FOR ALL USING (
        admin_id = auth.uid()
    ) WITH CHECK (
        admin_id = auth.uid()
    );


-- 2. Add Notification Preferences to Profiles
ALTER TABLE public.employees 
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB 
    DEFAULT '{"leave_approved": true, "leave_rejected": true, "attendance_reminder": true, "daily_report_reminder": true, "holiday_reminder": true, "company_announcement": true}'::JSONB;

ALTER TABLE public.admin_users 
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB 
    DEFAULT '{"leave_approval_required": true, "attendance_issues": true, "daily_reports_submitted": true, "new_applications": true, "system_alerts": true}'::JSONB;
