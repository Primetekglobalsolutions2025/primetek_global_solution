-- ====================================================================
-- PRIMETEK HR PORTAL — All Pending Migrations (Safe to re-run)
-- Run this entire block in Supabase SQL Editor
-- ====================================================================

-- ============================================================
-- MIGRATION 1: Attendance Break, Shift, and Leave Updates
-- ============================================================

-- 1. Update attendance status check constraint
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('Present', 'Late', 'Absent', 'Half-day', 'Pending WFH', 'Approved WFH', 'Rejected WFH', 'Working', 'On Break', 'Logged Out'));

-- 2. Add break, shift, and penalty columns to public.attendance
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deduction_applied NUMERIC(3,1) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS current_break_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_break_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS productive_hours NUMERIC(4,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS late_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permission_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shift_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manager_exemption BOOLEAN DEFAULT false;

-- Create indexes for quick queries on late flags and dates
CREATE INDEX IF NOT EXISTS idx_attendance_is_late ON public.attendance(is_late);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

-- 3. Add month column to leave_balances to support monthly allocation
ALTER TABLE public.leave_balances
ADD COLUMN IF NOT EXISTS month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE);

-- Drop old unique constraint on leave_balances and add monthly unique constraint
ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_employee_id_leave_type_year_key;

ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_employee_id_leave_type_year_month_key;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_employee_id_leave_type_year_month_key
UNIQUE (employee_id, leave_type, year, month);


-- ============================================================
-- MIGRATION 2: Leave Type — Support Casual + Unpaid
-- ============================================================

-- Drop existing type checks
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;
ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

-- Add aligned constraints accepting both Casual and Unpaid types
ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_type_check
CHECK (type IN ('Casual', 'Unpaid'));

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('Casual', 'Unpaid'));


-- ============================================================
-- MIGRATION 3: Late Penalty RPC Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_all_employee_lates(p_year INTEGER, p_month INTEGER)
RETURNS VOID AS $$
DECLARE
  v_start_date DATE := to_date(p_year || '-' || lpad(p_month::text, 2, '0') || '-01', 'YYYY-MM-DD');
  v_end_date DATE := v_start_date + interval '1 month';
  
  v_emp RECORD;
  v_rec RECORD;
  v_unexempted_ids UUID[];
  v_all_ids UUID[];
  v_unexempted_count INTEGER;
BEGIN
  -- Loop over active employees
  FOR v_emp IN SELECT id FROM public.employees WHERE status = 'Active' LOOP
    v_unexempted_ids := '{}';
    v_all_ids := '{}';
    
    -- Collect all late records for this employee in the month
    FOR v_rec IN 
      SELECT id, late_approved, permission_approved, shift_override, manager_exemption, status 
      FROM public.attendance
      WHERE employee_id = v_emp.id
        AND is_late = true
        AND date >= v_start_date
        AND date < v_end_date
      ORDER BY date ASC
    LOOP
      v_all_ids := array_append(v_all_ids, v_rec.id);
      
      -- Check if unexempted
      IF NOT COALESCE(v_rec.late_approved, false)
         AND NOT COALESCE(v_rec.permission_approved, false)
         AND NOT COALESCE(v_rec.shift_override, false)
         AND NOT COALESCE(v_rec.manager_exemption, false)
         AND COALESCE(v_rec.status, '') != 'Approved WFH'
      THEN
        v_unexempted_ids := array_append(v_unexempted_ids, v_rec.id);
      END IF;
    END LOOP;
    
    -- Reset all deductions to 0 for this month
    IF array_length(v_all_ids, 1) > 0 THEN
      UPDATE public.attendance
      SET deduction_applied = 0.0
      WHERE id = ANY(v_all_ids);
    END IF;
    
    -- Apply deductions if needed
    v_unexempted_count := array_length(v_unexempted_ids, 1);
    IF v_unexempted_count >= 6 THEN
      -- Apply 0.5 to 3rd and 6th records
      UPDATE public.attendance
      SET deduction_applied = 0.5
      WHERE id = ANY(ARRAY[v_unexempted_ids[3], v_unexempted_ids[6]]);
    ELSIF v_unexempted_count >= 3 THEN
      -- Apply 0.5 to 3rd record
      UPDATE public.attendance
      SET deduction_applied = 0.5
      WHERE id = v_unexempted_ids[3];
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- MIGRATION 4: Exports Storage Bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('exports', 'exports', false) 
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- MIGRATION 5: Cleanup RPC Functions (for cron)
-- ============================================================

-- Cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits 
  WHERE expire_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old risk events (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_risk_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.risk_assessment_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
EXCEPTION WHEN undefined_table THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- DONE — All migrations applied
-- ============================================================
SELECT 'All migrations applied successfully!' AS result;
