-- ==========================================
-- Migration 16: Add JD Document Column to Interview Requests
-- ==========================================
ALTER TABLE public.interview_requests ADD COLUMN jd_url TEXT;
