-- ====================================================================
-- Seed Office IP Whitelist Settings
-- ====================================================================

INSERT INTO public.portal_config (config_key, config_value, description)
VALUES ('office_ip_whitelist', '49.205.253.45', 'Comma-separated whitelisted office IP addresses or CIDR blocks')
ON CONFLICT (config_key) DO NOTHING;
