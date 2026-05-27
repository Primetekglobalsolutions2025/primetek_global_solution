-- Create private storage bucket for Excel exports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exports', 'exports', false) 
ON CONFLICT (id) DO NOTHING;
