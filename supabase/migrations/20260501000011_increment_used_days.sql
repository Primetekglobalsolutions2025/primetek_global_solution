-- ==========================================
-- 11. Atomic Leave Increment Function Migration (Idempotent)
-- ==========================================

CREATE OR REPLACE FUNCTION public.increment_used_days(
    p_employee_id UUID,
    p_leave_type TEXT,
    p_days INTEGER,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.leave_balances
    SET used_days = COALESCE(used_days, 0) + p_days
    WHERE employee_id = p_employee_id 
      AND leave_type = p_leave_type
      AND year = p_year
      AND month = p_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
