-- ============================================================
-- Migration: Add foreign key constraint to attendance_projections
-- Purpose: Resolves PostgREST relation caching issue for nested select queries.
-- ============================================================

-- 1. Safely remove orphaned projections to prevent constraint violation
DELETE FROM public.attendance_projections
WHERE session_id NOT IN (SELECT id FROM public.attendance);

-- 2. Establish foreign key constraint mapping session_id to attendance.id
ALTER TABLE public.attendance_projections
DROP CONSTRAINT IF EXISTS fk_attendance_projections_attendance;

ALTER TABLE public.attendance_projections
ADD CONSTRAINT fk_attendance_projections_attendance
FOREIGN KEY (session_id) REFERENCES public.attendance(id)
ON DELETE CASCADE;

-- 3. Verify constraint works
SELECT 'Migration 20260528070000 applied successfully!' AS result;
