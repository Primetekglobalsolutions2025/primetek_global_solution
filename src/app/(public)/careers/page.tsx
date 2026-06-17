import type { Metadata } from 'next';
import CareersPageClient from '@/components/sections/CareersPageClient';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Explore job openings at Primetek Global Solutions. Find roles in IT, Healthcare, Finance, Manufacturing, and more.',
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function CareersPage() {
  const { data: jobs, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs for careers page:', error);
  }

  return <CareersPageClient initialJobs={jobs || []} />;
}
