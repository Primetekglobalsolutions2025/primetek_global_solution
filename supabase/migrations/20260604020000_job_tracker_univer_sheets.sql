-- ==========================================
-- Create Job Tracker Univer Sheets Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.job_tracker_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sheet_name TEXT UNIQUE NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.job_tracker_sheets ENABLE ROW LEVEL SECURITY;

-- Note: No policies are created for 'anon' or public authenticated roles.
-- Access is restricted to the Next.js backend utilizing the supabaseAdmin service role client.
