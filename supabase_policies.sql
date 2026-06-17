-- ====================================================================
-- Primetek Global Solutions - RLS Hardening Script
-- Run this in your Supabase SQL Editor to secure all tables.
-- ====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing policies
DROP POLICY IF EXISTS "Public can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Public can insert inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Public can insert applications" ON public.applications;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- 3. Define Hardened Policies

-- Jobs: Public can only view active postings
CREATE POLICY "Public can view active jobs" 
ON public.jobs FOR SELECT 
USING (is_active = true);

-- Inquiries: Public can only submit (INSERT).
CREATE POLICY "Public can insert inquiries" 
ON public.inquiries FOR INSERT 
WITH CHECK (true);

-- Applications: Public can only submit (INSERT).
CREATE POLICY "Public can insert applications" 
ON public.applications FOR INSERT 
WITH CHECK (true);

-- Office Locations: Needed for client-side GPS check
CREATE POLICY "Public can view office locations" 
ON public.office_locations FOR SELECT 
USING (is_active = true);

-- Employees & Attendance: NO policies added for 'anon' role.
-- This ensures that these tables are 100% blocked from the public web.
-- Our Next.js backend uses the Service Role Key to manage these tables securely.

-- 4. Storage Security
-- Avatars bucket: Public viewing
CREATE POLICY "Public can view avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Resumes bucket: Private (No public policies)
-- Only our backend can read/write resumes.
