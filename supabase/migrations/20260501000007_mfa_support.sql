-- Add MFA columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

-- Add MFA columns to admin_users table
ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

-- Update RLS to allow users to update their own MFA settings
-- (Note: These are handled via Service Role in API usually, but good for completeness)
CREATE POLICY "Employees can update their own MFA" ON public.employees
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

COMMENT ON COLUMN public.employees.mfa_secret IS 'TOTP secret for MFA, encrypted at rest in production recommended';
COMMENT ON COLUMN public.admin_users.mfa_secret IS 'TOTP secret for MFA, encrypted at rest in production recommended';
