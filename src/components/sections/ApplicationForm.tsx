'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { applicationSchema, type ApplicationFormData } from '@/lib/validations';
import Button from '@/components/ui/Button';

interface ApplicationFormProps {
  jobId: string;
  jobTitle: string;
}

export default function ApplicationForm({ jobId, jobTitle }: ApplicationFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resume, setResume] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { job_id: jobId },
  });

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF or DOCX file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB.');
      return;
    }
    setResume(file);
  };

  const onSubmit = async (data: ApplicationFormData) => {
    setStatus('loading');
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formData.append(key, String(value));
      });
      if (resume) formData.append('resume', resume);

      const res = await fetch('/api/applications', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Submission failed');

      setStatus('success');
      reset();
      setResume(null);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl font-heading font-bold text-navy-900 mb-2">Application Submitted!</h3>
        <p className="text-text-secondary">
          Thank you for applying to <strong>{jobTitle}</strong>. Our team will review your application and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...register('job_id')} />

      {/* Name + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="app-name" className="block text-sm font-medium text-navy-900 mb-1.5">
            Full Name <span className="text-error">*</span>
          </label>
          <input
            id="app-name"
            type="text"
            placeholder="John Doe"
            {...register('name')}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm"
          />
          {errors.name && <p className="text-error text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="app-email" className="block text-sm font-medium text-navy-900 mb-1.5">
            Email <span className="text-error">*</span>
          </label>
          <input
            id="app-email"
            type="email"
            placeholder="john@email.com"
            {...register('email')}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm"
          />
          {errors.email && <p className="text-error text-xs mt-1">{errors.email.message}</p>}
        </div>
      </div>

      {/* Phone + Experience */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="app-phone" className="block text-sm font-medium text-navy-900 mb-1.5">
            Phone
          </label>
          <input
            id="app-phone"
            type="tel"
            placeholder="+91 98765 43210"
            {...register('phone')}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label htmlFor="app-exp" className="block text-sm font-medium text-navy-900 mb-1.5">
            Years of Experience
          </label>
          <input
            id="app-exp"
            type="number"
            min={0}
            max={50}
            placeholder="5"
            {...register('experience_years')}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Resume Upload */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1.5">
          Resume (PDF / DOCX, max 5MB)
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFileChange(e.dataTransfer.files[0] || null);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-primary-400 bg-primary-50/50'
              : resume
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-border hover:border-primary-300 hover:bg-primary-50/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          />
          {resume ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-6 h-6 text-emerald-500" />
              <span className="text-sm font-medium text-navy-900">{resume.name}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setResume(null); }}
                className="p-1 rounded-full hover:bg-gray-200 text-text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">
                <span className="text-primary-500 font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-text-muted mt-1">PDF or DOCX, max 5MB</p>
            </>
          )}
        </div>
      </div>

      {/* Cover Letter */}
      <div>
        <label htmlFor="app-cover" className="block text-sm font-medium text-navy-900 mb-1.5">
          Cover Letter (Optional)
        </label>
        <textarea
          id="app-cover"
          rows={4}
          placeholder="Tell us why you're a great fit for this role..."
          {...register('cover_letter')}
          className="w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm resize-none"
        />
      </div>

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={status === 'loading'}>
        {status === 'loading' ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
        ) : (
          <><Send className="w-5 h-5" /> Submit Application</>
        )}
      </Button>

      {status === 'error' && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Something went wrong. Please try again.
        </div>
      )}
    </form>
  );
}
