-- Add phone and designation columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT;
