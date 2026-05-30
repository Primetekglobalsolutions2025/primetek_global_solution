-- ============================================================
-- Primetek HR Portal - Migration: Admin Operational Hardening
-- ============================================================

-- 1. Setup Custom Types & Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_type') THEN
        CREATE TYPE public.admin_role_type AS ENUM ('SUPER_ADMIN', 'HR_ADMIN', 'OPERATIONS_ADMIN', 'AUDITOR_READONLY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE public.dispute_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_category') THEN
        CREATE TYPE public.dispute_category AS ENUM ('GPS_AUTO_BREAK', 'IDLE_WARNING', 'LATE_PENALTY', 'MISSING_TIME');
    END IF;
END $$;

-- 2. Add Role Column to admin_users Table
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS role public.admin_role_type NOT NULL DEFAULT 'OPERATIONS_ADMIN';

-- 3. Create Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    category public.dispute_category NOT NULL,
    reason TEXT NOT NULL,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    status public.dispute_status NOT NULL DEFAULT 'PENDING',
    admin_justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exist
DROP POLICY IF EXISTS "Employees can view own disputes" ON public.disputes;
DROP POLICY IF EXISTS "Employees can create disputes" ON public.disputes;
DROP POLICY IF EXISTS "Admins manage all disputes" ON public.disputes;

-- Create Policies
CREATE POLICY "Employees can view own disputes" ON public.disputes
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Employees can create disputes" ON public.disputes
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admins manage all disputes" ON public.disputes
    FOR ALL USING (public.is_admin());

-- Update modified column trigger
DROP TRIGGER IF EXISTS update_disputes_modtime ON public.disputes;
CREATE TRIGGER update_disputes_modtime
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 4. Deploy Transactional Late Recalculator Function
CREATE OR REPLACE FUNCTION public.recalculate_employee_lates_safe(
    p_employee_id UUID, 
    p_year INTEGER, 
    p_month INTEGER
) RETURNS VOID AS $$
DECLARE
  v_locked_emp_id UUID;
  v_unexempted_ids UUID[];
  v_all_ids UUID[];
  v_start_date DATE := to_date(p_year || '-' || lpad(p_month::text, 2, '0') || '-01', 'YYYY-MM-DD');
  v_end_date DATE := v_start_date + interval '1 month';
BEGIN
  -- Lock parent employee record to serialise lates adjustments
  SELECT id INTO v_locked_emp_id 
  FROM public.employees 
  WHERE id = p_employee_id 
  FOR UPDATE;

  -- Lock monthly attendance rows for employee first (without aggregate)
  PERFORM id FROM public.attendance
  WHERE employee_id = p_employee_id 
    AND date >= v_start_date 
    AND date < v_end_date
  FOR UPDATE;

  -- Now aggregate the IDs safely
  SELECT COALESCE(array_agg(id ORDER BY date ASC), '{}') INTO v_all_ids
  FROM public.attendance
  WHERE employee_id = p_employee_id 
    AND date >= v_start_date 
    AND date < v_end_date;

  -- Fetch unexempted lates
  SELECT COALESCE(array_agg(id ORDER BY date ASC), '{}') INTO v_unexempted_ids
  FROM public.attendance
  WHERE employee_id = p_employee_id
    AND is_late = true
    AND date >= v_start_date
    AND date < v_end_date
    AND NOT COALESCE(late_approved, false)
    AND NOT COALESCE(permission_approved, false)
    AND NOT COALESCE(shift_override, false)
    AND NOT COALESCE(manager_exemption, false)
    AND status <> 'Approved WFH';

  -- Clear deductions in the locked set
  IF array_length(v_all_ids, 1) > 0 THEN
    UPDATE public.attendance
    SET deduction_applied = 0.0
    WHERE id = ANY(v_all_ids);
  END IF;

  -- Apply targeted deductions
  IF array_length(v_unexempted_ids, 1) >= 6 THEN
    UPDATE public.attendance
    SET deduction_applied = 0.5
    WHERE id = ANY(ARRAY[v_unexempted_ids[3], v_unexempted_ids[6]]);
  ELSIF array_length(v_unexempted_ids, 1) >= 3 THEN
    UPDATE public.attendance
    SET deduction_applied = 0.5
    WHERE id = v_unexempted_ids[3];
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
