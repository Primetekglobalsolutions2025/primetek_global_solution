'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus, Briefcase, Info, GraduationCap, Link2, MapPin } from 'lucide-react';
import { fullApplicationSchema, type FullApplicationFormData } from '@/lib/validations';
import { createFullApplication, getActiveJobs, getAllEmployees } from '@/app/admin/applications/actions';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface AddApplicationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddApplicationForm({ onSuccess, onCancel }: AddApplicationFormProps) {
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FullApplicationFormData>({
    resolver: zodResolver(fullApplicationSchema),
  });

  useEffect(() => {
    getActiveJobs().then(setJobs);
    getAllEmployees().then(setEmployees);
  }, []);

  const onSubmit = async (data: FullApplicationFormData) => {
    setStatus('loading');
    try {
      await createFullApplication(data);
      setStatus('success');
      toast.success('Application created successfully!');
      setTimeout(onSuccess, 1000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      toast.error('Failed to create application.');
    }
  };

  const inputClasses = "w-full px-3 py-2 rounded-lg border border-border bg-white text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all duration-150";
  const labelClasses = "block text-xs font-semibold text-navy-900 mb-1";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 1. Basic Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-primary-600 border-b border-primary-50 pb-1.5">
          <Briefcase className="w-3.5 h-3.5" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Job & Basic Info</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelClasses}>Select Job</label>
            <select {...register('job_id')} className={inputClasses}>
              <option value="">Select a job...</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {errors.job_id && <p className="text-xs text-red-500 mt-1">{errors.job_id.message}</p>}
          </div>

          <div>
            <label className={labelClasses}>Assign Employee (Optional)</label>
            <select {...register('assigned_to')} className={inputClasses}>
              <option value="">Unassigned</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelClasses}>Applicant Name</label>
            <input {...register('name')} placeholder="Full Name" className={inputClasses} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className={labelClasses}>Email Address</label>
            <input {...register('email')} type="email" placeholder="email@example.com" className={inputClasses} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelClasses}>Phone Number</label>
            <input {...register('phone')} placeholder="+91 ..." className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Experience (Years)</label>
            <input {...register('experience_years')} type="number" step="0.1" className={inputClasses} />
          </div>
        </div>
      </div>

      {/* 2. Profile Details */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-1.5 text-primary-600 border-b border-primary-50 pb-1.5">
          <Info className="w-3.5 h-3.5" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Client Profile Details</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelClasses}>Current Role</label>
            <input {...register('client_role')} placeholder="e.g. Senior Developer" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>LinkedIn Link</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-muted" />
              <input {...register('client_linkedin')} placeholder="linkedin.com/in/..." className={`${inputClasses} pl-9`} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClasses}>Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-muted" />
            <textarea {...register('client_address')} rows={2} placeholder="Full current address" className={`${inputClasses} pl-9 pt-1.5`} />
          </div>
        </div>
      </div>

      {/* 3. Education */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-1.5 text-primary-600 border-b border-primary-50 pb-1.5">
          <GraduationCap className="w-3.5 h-3.5" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Education</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelClasses}>Bachelor&apos;s Degree</label>
            <input {...register('education_bachelors')} placeholder="Degree, University, Year" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Master&apos;s Degree</label>
            <input {...register('education_masters')} placeholder="Degree, University, Year" className={inputClasses} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border/40">
        <Button variant="outline" className="flex-1" size="sm" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button className="flex-1" size="sm" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Create Application</>}
        </Button>
      </div>
    </form>
  );
}
