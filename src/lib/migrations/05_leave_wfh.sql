-- ==========================================
-- Migration: Phase 5 - Leave & WFH Management
-- ==========================================

-- 1. Update Attendance Status Constraints
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('Present', 'Late', 'Absent', 'Half-day', 'Pending WFH', 'Approved WFH', 'Rejected WFH'));

-- 2. Create Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Sick', 'Casual', 'Earned', 'Maternity', 'Paternity')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_leave_requests_modtime
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Policies (Simplified for Admin/Employee use via Service Role)
CREATE POLICY "Admins have full access to leave_requests" ON public.leave_requests FOR ALL USING (public.is_admin());
