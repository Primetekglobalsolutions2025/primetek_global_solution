-- 14_performance_indexes.sql
-- Migration to add missing indexes for performance optimization

-- Composite index on attendance to optimize employee lookup and chronological order checks
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date_desc 
ON attendance (employee_id, date DESC);

-- Index on leave_requests to optimize checking status of requests for employees
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status 
ON leave_requests (employee_id, status);
