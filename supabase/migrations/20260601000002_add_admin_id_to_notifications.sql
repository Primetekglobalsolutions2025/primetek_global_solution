-- ====================================================================
-- Primetek Global Solutions - Admin Notifications & Reads Schema
-- ====================================================================

-- 1. Add columns to public.notifications
ALTER TABLE public.notifications 
    ADD COLUMN IF NOT EXISTS is_for_admin BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE;

-- Create index for admin notifications
CREATE INDEX IF NOT EXISTS idx_notifications_admin_id ON public.notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_for_admin ON public.notifications(is_for_admin);

-- 2. Modify public.notification_reads for admin support
-- Drop PK constraint
ALTER TABLE public.notification_reads DROP CONSTRAINT IF EXISTS notification_reads_pkey;

-- Allow employee_id to be NULL
ALTER TABLE public.notification_reads ALTER COLUMN employee_id DROP NOT NULL;

-- Add admin_id column
ALTER TABLE public.notification_reads 
    ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE;

-- Create index for admin reads
CREATE INDEX IF NOT EXISTS idx_notification_reads_admin_id ON public.notification_reads(admin_id);

-- Add check constraint to ensure exactly one of employee_id or admin_id is set
ALTER TABLE public.notification_reads DROP CONSTRAINT IF EXISTS chk_notification_reads_target;
ALTER TABLE public.notification_reads ADD CONSTRAINT chk_notification_reads_target 
    CHECK (
        (employee_id IS NOT NULL AND admin_id IS NULL) OR 
        (employee_id IS NULL AND admin_id IS NOT NULL)
    );

-- Create unique indexes to prevent duplicate read entries
DROP INDEX IF EXISTS idx_notification_reads_emp_uniq;
CREATE UNIQUE INDEX idx_notification_reads_emp_uniq 
    ON public.notification_reads (notification_id, employee_id) 
    WHERE employee_id IS NOT NULL;

DROP INDEX IF EXISTS idx_notification_reads_admin_uniq;
CREATE UNIQUE INDEX idx_notification_reads_admin_uniq 
    ON public.notification_reads (notification_id, admin_id) 
    WHERE admin_id IS NOT NULL;

-- 3. Update RLS policies
DROP POLICY IF EXISTS "Employees can view their own notifications" ON public.notifications;
CREATE POLICY "Employees can view their own notifications" ON public.notifications
    FOR SELECT USING (
        (employee_id IS NULL AND (is_for_admin IS FALSE OR is_for_admin IS NULL)) OR 
        employee_id = auth.uid()
    );

DROP POLICY IF EXISTS "Employees can insert their own reads" ON public.notification_reads;
CREATE POLICY "Employees can insert their own reads" ON public.notification_reads
    FOR INSERT WITH CHECK (
        employee_id = auth.uid() AND admin_id IS NULL
    );
