-- ==========================================
-- Audit Logs Table
-- Tracks critical actions performed by admins and employees
-- ==========================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References admin_users or employees id
    user_role TEXT NOT NULL, -- 'admin' or 'employee'
    action TEXT NOT NULL, -- e.g., 'DELETE_INQUIRY', 'UPDATE_JOB', 'CHECK_IN'
    entity_type TEXT NOT NULL, -- e.g., 'inquiries', 'jobs', 'attendance'
    entity_id UUID, -- ID of the affected record
    old_data JSONB, -- Optional snapshot before change
    new_data JSONB, -- Optional snapshot after change
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_admin());

-- Function to easily create audit logs from server actions
CREATE OR REPLACE FUNCTION public.log_action(
    p_user_id UUID,
    p_user_role TEXT,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, user_role, action, entity_type, entity_id, old_data, new_data)
    VALUES (p_user_id, p_user_role, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
