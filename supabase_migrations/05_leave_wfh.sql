-- ====================================================================
-- Phase 5: Leave & WFH Management Migration
-- ====================================================================

-- 1. Create Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Sick', 'Casual', 'Earned', 'Maternity', 'Paternity')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    approved_by UUID REFERENCES public.employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update Attendance Table Constraints
-- Drop the old constraint to support WFH statuses
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Add updated constraint
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('Present', 'Late', 'Absent', 'Half-day', 'Pending WFH', 'Approved WFH', 'Rejected WFH'));

-- 3. Enable RLS on Leave Requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 4. Admin Policy for Leave Requests
CREATE POLICY "Admins have full access to leave_requests" 
ON public.leave_requests FOR ALL USING (public.is_admin());

-- 5. Trigger for updated_at
CREATE TRIGGER update_leave_requests_modtime
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. Indices for Performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);
