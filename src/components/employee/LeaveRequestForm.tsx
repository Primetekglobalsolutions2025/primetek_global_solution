'use client';

import { useState } from 'react';
import { Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { applyForLeave } from '@/app/employee/leaves/actions';
import { cn } from '@/lib/utils';

const leaveTypes = ['Sick', 'Casual', 'Earned', 'Maternity', 'Paternity'];

export default function LeaveRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      type: formData.get('type') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      reason: formData.get('reason') as string,
    };

    try {
      const result = await applyForLeave(data);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          setSuccess(false);
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full px-4 py-3 rounded-xl border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {success ? (
        <div className="py-12 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-navy-900">Request Submitted!</h3>
          <p className="text-sm text-text-secondary mt-2">Your leave request is pending approval.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Type of Leave</label>
              <select name="type" required className={inputClasses}>
                {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Reason (Optional)</label>
              <input type="text" name="reason" placeholder="Brief reason..." className={inputClasses} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="date" name="start_date" required className={cn(inputClasses, "pl-10")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="date" name="end_date" required className={cn(inputClasses, "pl-10")} />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full py-4 shadow-lg shadow-primary-500/20">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : "Submit Leave Request"}
          </Button>
        </>
      )}
    </form>
  );
}
