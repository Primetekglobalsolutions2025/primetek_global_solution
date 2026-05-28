-- Seed default system status nodes
INSERT INTO public.system_status (node_name, status, color) VALUES
('Database', 'Active', 'bg-emerald-500'),
('API Gateway', 'Optimal', 'bg-emerald-500'),
('Auth System', 'Active', 'bg-emerald-500'),
('Heartbeat Engine', 'Active', 'bg-emerald-500'),
('Mail Server', 'Active', 'bg-emerald-500')
ON CONFLICT (node_name) DO NOTHING;
