'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, ArrowLeft } from 'lucide-react';
import { jobSchema, type JobFormData } from '@/lib/validations';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
interface JobFormProps {
  jobId?: string;
  defaultValues?: Partial<JobFormData>;
  isEditing?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveAction: (data: JobFormData, id?: string) => Promise<any>;
  onSuccess?: () => void;
}

const departments = ['Information Technology', 'Healthcare', 'Banking & Finance', 'Manufacturing', 'Retail & E-Commerce'];
const locations = ['Hyderabad', 'Bangalore', 'Remote', 'Mumbai', 'Delhi', 'Chennai'];
const jobTypes = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'remote', label: 'Remote' },
  { value: 'part-time', label: 'Part-time' },
];

export default function JobForm({ jobId, defaultValues, isEditing, saveAction, onSuccess }: JobFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      is_active: true,
      ...defaultValues,
    },
  });

  const onSubmit = async (data: JobFormData) => {
    try {
      await saveAction(data, jobId);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/admin/jobs');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save job. See console.');
    }
  };

  const inputClasses = 'w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm';

  return (
    <Card hover={false} className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="job-title" className="block text-sm font-medium text-navy-900 mb-1.5">
            Job Title <span className="text-error">*</span>
          </label>
          <input id="job-title" type="text" placeholder="Senior React Developer" {...register('title')} className={inputClasses} />
          {errors.title && <p className="text-error text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* Department + Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="job-dept" className="block text-sm font-medium text-navy-900 mb-1.5">
              Department <span className="text-error">*</span>
            </label>
            <select id="job-dept" {...register('department')} className={inputClasses}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.department && <p className="text-error text-xs mt-1">{errors.department.message}</p>}
          </div>
          <div>
            <label htmlFor="job-loc" className="block text-sm font-medium text-navy-900 mb-1.5">
              Location <span className="text-error">*</span>
            </label>
            <select id="job-loc" {...register('location')} className={inputClasses}>
              <option value="">Select location</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {errors.location && <p className="text-error text-xs mt-1">{errors.location.message}</p>}
          </div>
        </div>

        {/* Type + Salary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="job-type" className="block text-sm font-medium text-navy-900 mb-1.5">
              Job Type <span className="text-error">*</span>
            </label>
            <select id="job-type" {...register('type')} className={inputClasses}>
              <option value="">Select type</option>
              {jobTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {errors.type && <p className="text-error text-xs mt-1">{errors.type.message}</p>}
          </div>
          <div>
            <label htmlFor="job-salary" className="block text-sm font-medium text-navy-900 mb-1.5">
              Salary Range
            </label>
            <input id="job-salary" type="text" placeholder="₹15L – ₹25L" {...register('salary_range')} className={inputClasses} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="job-desc" className="block text-sm font-medium text-navy-900 mb-1.5">
            Description <span className="text-error">*</span>
          </label>
          <textarea id="job-desc" rows={5} placeholder="Describe the role, responsibilities, and what the candidate will work on..." {...register('description')} className={`${inputClasses} resize-none`} />
          {errors.description && <p className="text-error text-xs mt-1">{errors.description.message}</p>}
        </div>

        {/* Requirements */}
        <div>
          <label htmlFor="job-reqs" className="block text-sm font-medium text-navy-900 mb-1.5">
            Requirements <span className="text-error">*</span>
          </label>
          <textarea id="job-reqs" rows={5} placeholder="• 5+ years React experience&#10;• TypeScript proficiency&#10;• Strong communication skills" {...register('requirements')} className={`${inputClasses} resize-none`} />
          {errors.requirements && <p className="text-error text-xs mt-1">{errors.requirements.message}</p>}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center gap-3">
          <input id="job-active" type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-400" />
          <label htmlFor="job-active" className="text-sm font-medium text-navy-900">
            Publish this job (visible on careers page)
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="w-4 h-4" /> {isEditing ? 'Update Job' : 'Create Job'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
