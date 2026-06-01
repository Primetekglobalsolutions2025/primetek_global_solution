-- ============================================================
-- MIGRATION: WFH Pre-Approval & Global Override System
-- ============================================================

-- 1. Create WFH Requests Table
CREATE TABLE IF NOT EXISTS public.wfh_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE, -- NULL = "Global WFH" for all employees
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT wfh_requests_date_check CHECK (start_date <= end_date)
);

-- Trigger to automatically update modified timestamp
DROP TRIGGER IF EXISTS update_wfh_requests_modtime ON public.wfh_requests;
CREATE TRIGGER update_wfh_requests_modtime
    BEFORE UPDATE ON public.wfh_requests
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS on WFH Requests
ALTER TABLE public.wfh_requests ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies for WFH Requests
DROP POLICY IF EXISTS "Admins have full access to wfh_requests" ON public.wfh_requests;
CREATE POLICY "Admins have full access to wfh_requests" ON public.wfh_requests 
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Employees can view global or their own wfh_requests" ON public.wfh_requests;
CREATE POLICY "Employees can view global or their own wfh_requests" ON public.wfh_requests
    FOR SELECT USING (
        employee_id IS NULL OR 
        employee_id = auth.uid()
    );

DROP POLICY IF EXISTS "Employees can insert their own wfh_requests" ON public.wfh_requests;
CREATE POLICY "Employees can insert their own wfh_requests" ON public.wfh_requests
    FOR INSERT WITH CHECK (
        employee_id = auth.uid() AND 
        status = 'Pending'
    );

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_wfh_requests_employee_id ON public.wfh_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_wfh_requests_start_date ON public.wfh_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_wfh_requests_end_date ON public.wfh_requests(end_date);
CREATE INDEX IF NOT EXISTS idx_wfh_requests_status ON public.wfh_requests(status);


-- 2. Create Active WFH Check Helper Function
CREATE OR REPLACE FUNCTION public.check_active_wfh(p_employee_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.wfh_requests
    WHERE status = 'Approved'
      AND p_date >= start_date 
      AND p_date <= end_date
      AND (employee_id IS NULL OR employee_id = p_employee_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
