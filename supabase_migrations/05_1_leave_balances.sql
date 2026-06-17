-- ==========================================
-- Phase 5.1: Leave Balances Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('Sick', 'Casual', 'Earned', 'Maternity', 'Paternity')),
    total_days INTEGER DEFAULT 12,
    used_days INTEGER DEFAULT 0,
    remaining_days INTEGER GENERATED ALWAYS AS (total_days - used_days) STORED,
    year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, leave_type, year)
);

-- Seed initial balances for all active employees
INSERT INTO public.leave_balances (employee_id, leave_type, total_days)
SELECT id, 'Sick', 12 FROM public.employees
ON CONFLICT DO NOTHING;

INSERT INTO public.leave_balances (employee_id, leave_type, total_days)
SELECT id, 'Casual', 10 FROM public.employees
ON CONFLICT DO NOTHING;

INSERT INTO public.leave_balances (employee_id, leave_type, total_days)
SELECT id, 'Earned', 15 FROM public.employees
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to leave_balances" ON public.leave_balances FOR ALL USING (public.is_admin());
CREATE POLICY "Employees can view their own balances" ON public.leave_balances FOR SELECT USING (employee_id = (SELECT id FROM public.employees WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

-- Trigger for updated_at
CREATE TRIGGER update_leave_balances_modtime
    BEFORE UPDATE ON public.leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
