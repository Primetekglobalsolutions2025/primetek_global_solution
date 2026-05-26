-- ==========================================
-- 12. Create Missing System Status & Config Tables Migration (Idempotent)
-- ==========================================

-- 1. Create portal_config table if not exists
CREATE TABLE IF NOT EXISTS public.portal_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on portal_config
ALTER TABLE public.portal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to portal_config" ON public.portal_config;
CREATE POLICY "Admins have full access to portal_config" 
  ON public.portal_config FOR ALL USING (public.is_admin());


-- 2. Create system_status table if not exists
CREATE TABLE IF NOT EXISTS public.system_status (
    node_name TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    color TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on system_status
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to system_status" ON public.system_status;
CREATE POLICY "Admins have full access to system_status" 
  ON public.system_status FOR ALL USING (public.is_admin());

-- Pre-populate default nodes in system_status
INSERT INTO public.system_status (node_name, status, color)
VALUES 
  ('Authentication', 'Active', 'bg-emerald-500'),
  ('DB Cluster', 'Syncing', 'bg-emerald-500'),
  ('Mail Server', 'Active', 'bg-emerald-500'),
  ('API Gateway', 'Optimal', 'bg-primary-400')
ON CONFLICT (node_name) DO NOTHING;
