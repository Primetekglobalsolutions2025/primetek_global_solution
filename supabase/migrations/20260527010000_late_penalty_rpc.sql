-- Recalculate All Employee Lates stored procedure for performance optimization
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
