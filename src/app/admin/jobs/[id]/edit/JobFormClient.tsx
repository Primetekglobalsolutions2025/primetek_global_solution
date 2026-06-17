'use client';

import JobForm from '@/components/admin/JobForm';
import { useRouter } from 'next/navigation';
import { type JobFormData } from '@/lib/validations';

interface JobRecord {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  salary_range?: string | null;
  is_active: boolean;
}

export default function JobFormClient({ 
  job, 
  saveAction 
}: { 
  job: JobRecord; 
  saveAction: (data: JobFormData, id?: string) => Promise<unknown>; 
}) {
  const router = useRouter();

  return (
    <JobForm
      isEditing
      jobId={job.id}
      saveAction={saveAction}
      onSuccess={() => router.push('/admin/jobs')}
      defaultValues={{
        title: job.title,
        department: job.department,
   
        location: job.location,
        type: job.type as JobFormData['type'],
        description: job.description,
        requirements: job.requirements,
        salary_range: job.salary_range || undefined,
        is_active: job.is_active,
      }}
    />
  );
}
