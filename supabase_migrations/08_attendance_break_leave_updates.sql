-- ====================================================================
-- Attendance Break, Shift, and Late Penalty Updates
-- ====================================================================

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

-- 3. Simplify Leave Management to Casual Leave Only
-- Delete all existing non-Casual requests and balances
DELETE FROM public.leave_requests WHERE type != 'Casual';
DELETE FROM public.leave_balances WHERE leave_type != 'Casual';

-- Update constraints on leave_requests and leave_balances
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_type_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_type_check
CHECK (type = 'Casual');

ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type = 'Casual');

-- Add month column to leave_balances to support monthly allocation
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
