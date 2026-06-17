import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import JobFormClient from './JobFormClient';
import { saveJob } from '../../actions';

export default async function AdminAppEditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !job) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-navy-900 tracking-tight">Edit Job</h1>
        <p className="text-text-secondary text-sm">Update details for &ldquo;{job.title}&rdquo;.</p>
      </div>
      <JobFormClient 
        job={job}
        saveAction={saveJob}
      />
    </div>
  );
}
