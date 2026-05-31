-- ====================================================================
-- Primetek Global Solutions - Notification Lifecycle Management Schema
-- ====================================================================

-- 1. Add is_pinned column to notifications table
ALTER TABLE public.notifications 
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 2. Create index for query-time filtering performance
CREATE INDEX IF NOT EXISTS idx_notifications_is_pinned_created_at 
    ON public.notifications(is_pinned, created_at DESC);
