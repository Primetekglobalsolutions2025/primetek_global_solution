-- Migration 15: Add role_category column to application_profiles table
ALTER TABLE public.application_profiles 
ADD COLUMN IF NOT EXISTS role_category TEXT DEFAULT 'IT' CHECK (role_category IN ('IT', 'Non-IT'));
