-- System Health & Node Monitoring
CREATE TABLE IF NOT EXISTS public.system_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    color TEXT NOT NULL,
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY "Admins have full access to system_status" ON public.system_status FOR ALL USING (public.is_admin());
-- Public/Authenticated useraas can read (for settings page status)
CREATE POLICY "Anyone can view system_status" ON public.system_status FOR SELECT USING (true);

-- Initial Data for System Status
INSERT INTO public.system_status (node_name, status, color) VALUES
('Authentication', 'Active', 'bg-emerald-500'),
('DB Cluster', 'Syncing', 'bg-emerald-500'),
('Mail Server', 'Active', 'bg-emerald-500'),
('API Gateway', 'Optimal', 'bg-primary-400')
ON CONFLICT (node_name) DO UPDATE 
SET status = EXCLUDED.status, color = EXCLUDED.color, updated_at = NOW();

-- Portal Configuration
CREATE TABLE IF NOT EXISTS public.portal_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.portal_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view portal_config" ON public.portal_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage portal_config" ON public.portal_config FOR ALL USING (public.is_admin());

-- Initial Config
INSERT INTO public.portal_config (config_key, config_value, description) VALUES
('default_sick_leave', '12', 'Default annual sick leave credits for new employees'),
('default_casual_leave', '1', 'Default monthly casual leave credits for new employees'),
('default_earned_leave', '15', 'Default annual earned leave credits for new employees'),
('operational_policy', 'Deployment to Remote (WFH) nodes requires geospatial verification and Administrative authorization to maintain synchronized attendance metrics.', 'Operational policy text shown on employee dashboard')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
