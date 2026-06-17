'use client';

import JobForm from '@/components/admin/JobForm';
import { saveJob } from '../actions';
import { useRouter } from 'next/navigation';

export default function AdminAppNewJobPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-navy-900 tracking-tight">Create New Job</h1>
        <p className="text-text-secondary text-sm">Add a new job posting to the portal.</p>
      </div>
      <JobForm 
        saveAction={saveJob} 
        onSuccess={() => router.push('/admin/jobs')}
      />
    </div>
  );
}
