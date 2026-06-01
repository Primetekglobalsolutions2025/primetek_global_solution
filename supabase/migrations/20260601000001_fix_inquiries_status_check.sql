-- ====================================================================
-- Primetek Global Solutions - Fix Inquiries Status Check Constraint
-- ====================================================================

-- 1. Drop existing status check constraint if it exists
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;

-- 2. Add updated status check constraint allowing 'new', 'in-progress', 'resolved', 'contacted', 'qualified', 'closed'
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_status_check CHECK (status IN ('new', 'in-progress', 'resolved', 'contacted', 'qualified', 'closed'));
