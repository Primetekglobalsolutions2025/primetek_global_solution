-- ====================================================================
-- Primetek Global Solutions - Holidays & In-App Notifications Migration
-- ====================================================================

-- 1. Create Holidays Table
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date DATE UNIQUE NOT NULL, -- Ensure only one holiday can be defined per calendar date
    type TEXT NOT NULL CHECK (type IN ('Company Holiday', 'Optional Holiday', 'Public Holiday')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to automatically update modified timestamp
CREATE TRIGGER update_holidays_modtime
    BEFORE UPDATE ON public.holidays
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS on Holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies for Holidays
CREATE POLICY "Anyone can view holidays" ON public.holidays 
    FOR SELECT USING (true);

CREATE POLICY "Admins have full access to holidays" ON public.holidays 
    FOR ALL USING (public.is_admin());


-- 2. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'announcement' CHECK (type IN ('announcement', 'personal', 'alert')),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE, -- NULL = broadcast to all employees
    sender_name TEXT DEFAULT 'Admin',
    is_read BOOLEAN DEFAULT false, -- Used for targeted/personal notifications
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies for Notifications
CREATE POLICY "Admins have full access to notifications" ON public.notifications 
    FOR ALL USING (public.is_admin());

CREATE POLICY "Employees can view their own notifications" ON public.notifications
    FOR SELECT USING (
        employee_id IS NULL OR 
        employee_id = auth.uid()
    );


-- 3. Create Notification Reads Table (for tracking broadcast read states)
CREATE TABLE IF NOT EXISTS public.notification_reads (
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (notification_id, employee_id)
);

-- Enable RLS on Reads
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies for Reads
CREATE POLICY "Admins have full access to notification_reads" ON public.notification_reads 
    FOR ALL USING (public.is_admin());

CREATE POLICY "Employees can insert their own reads" ON public.notification_reads
    FOR INSERT WITH CHECK (
        employee_id = auth.uid()
    );

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_notifications_employee_id ON public.notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_employee_id ON public.notification_reads(employee_id);
