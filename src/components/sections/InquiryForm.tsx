'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { inquirySchema, type InquiryFormData } from '@/lib/validations';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';

export default function InquiryForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
  });

  const onSubmit = async (data: InquiryFormData) => {
    setStatus('loading');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Submission failed');

      setStatus('success');
      reset();
      setTimeout(() => setStatus('idle'), 5000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name */}
      <Input
        id="inquiry-name"
        type="text"
        label={
          <>
            Full Name <span className="text-error">*</span>
          </>
        }
        placeholder="John Doe"
        error={errors.name?.message}
        {...register('name')}
      />

      {/* Email */}
      <Input
        id="inquiry-email"
        type="email"
        label={
          <>
            Email Address <span className="text-error">*</span>
          </>
        }
        placeholder="john@company.com"
        error={errors.email?.message}
        {...register('email')}
      />

      {/* Company + Phone Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Input
          id="inquiry-company"
          type="text"
          label="Company"
          placeholder="Acme Inc."
          error={errors.company?.message}
          {...register('company')}
        />
        <Input
          id="inquiry-phone"
          type="tel"
          label="Phone"
          placeholder="+91 98765 43210"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      {/* Requirement */}
      <Textarea
        id="inquiry-requirement"
        rows={4}
        label={
          <>
            How Can We Help? <span className="text-error">*</span>
          </>
        }
        placeholder="Tell us about your staffing needs, timeline, and any specific requirements..."
        error={errors.requirement?.message}
        className="resize-none"
        {...register('requirement')}
      />

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Sending...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" /> Submit Inquiry
          </>
        )}
      </Button>

      {/* Feedback */}
      {status === 'success' && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          Thank you! We&apos;ll get back to you within 24 hours.
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Something went wrong. Please try again or email us directly.
        </div>
      )}
    </form>
  );
}
