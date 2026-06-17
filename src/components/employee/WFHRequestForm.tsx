'use client';

import { useState } from 'react';
import { Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { submitWFHRequest } from '@/app/employee/wfh/actions';
import { cn } from '@/lib/utils';

export default function WFHRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      reason: formData.get('reason') as string,
    };

    try {
      const result = await submitWFHRequest(data);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          setSuccess(false);
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit WFH request');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit WFH request';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full px-3 py-2 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm transition-all duration-150";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success ? (
        <div className="py-10 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-navy-900">WFH Request Submitted!</h3>
          <p className="text-xs text-text-secondary mt-1.5">Your Work From Home request is pending manager approval.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy-900 mb-1 ml-0.5">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="date" name="start_date" required className={cn(inputClasses, "pl-9")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-900 mb-1 ml-0.5">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="date" name="end_date" required className={cn(inputClasses, "pl-9")} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-900 mb-1 ml-0.5">Reason / Justification</label>
            <textarea 
              name="reason" 
              required 
              rows={3} 
              placeholder="Provide context for working from home (e.g. transport strike, home repairs)..." 
              className={cn(inputClasses, "resize-none")}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} size="sm" className="w-full shadow-sm">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit WFH Request"}
          </Button>
        </>
      )}
    </form>
  );
}
