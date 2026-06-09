-- ====================================================================
-- Primetek Global Solutions - Real-Time Employee Presence Schema
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.employee_presence (
    employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('working', 'idle', 'break', 'offline')),
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    break_started_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger to automatically update modified timestamp
DROP TRIGGER IF EXISTS update_employee_presence_modtime ON public.employee_presence;
CREATE TRIGGER update_employee_presence_modtime
    BEFORE UPDATE ON public.employee_presence
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create index for performance on heartbeat check
CREATE INDEX IF NOT EXISTS idx_employee_presence_last_heartbeat ON public.employee_presence(last_heartbeat);

-- Enable RLS
ALTER TABLE public.employee_presence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public SELECT on employee_presence" ON public.employee_presence;

-- Allow SELECT for everyone (including anon key for Realtime WebSocket)
CREATE POLICY "Allow public SELECT on employee_presence" ON public.employee_presence
    FOR SELECT USING (true);

-- Note: No write policies are defined, restricting INSERT/UPDATE/DELETE strictly to service role (server-side).

-- Enable Realtime for employee_presence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'employee_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_presence;
  END IF;
END $$;

-- Function to cleanup stale presence records (>5 minutes old)
CREATE OR REPLACE FUNCTION public.cleanup_stale_presence()
RETURNS void AS $$
BEGIN
    DELETE FROM public.employee_presence
    WHERE last_heartbeat < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
