-- ====================================================================
-- Align leave requests and balances check constraints to support Unpaid type
-- ====================================================================

-- 1. Drop existing type checks
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;
ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

-- 2. Add aligned constraints accepting both Casual and Unpaid types
ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_type_check
CHECK (type IN ('Casual', 'Unpaid'));

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('Casual', 'Unpaid'));
