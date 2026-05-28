'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordFormData } from '@/lib/validations';
import { changePassword } from '@/app/admin/profile/actions';
import Button from '@/components/ui/Button';

export default function PasswordChangeForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await changePassword(data);
      if (res && res.success) {
        setStatus('success');
        reset();
      } else {
        setStatus('error');
        setErrorMsg(res?.error || 'Failed to update password');
      }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to update password');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-md bg-primary-500/10 text-primary-650 border border-primary-500/20 flex items-center justify-center">
          <ShieldCheck className="w-4.5 h-4.5" />
        </div>
        <h3 className="text-sm font-semibold text-navy-900">Change Password</h3>
      </div>

      {status === 'success' && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-700 text-xs mb-4 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="font-semibold">Password updated successfully!</p>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2.5 text-red-700 text-xs mb-4 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Current Password</label>
          <input
            {...register('currentPassword')}
            type="password"
            className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs"
          />
          {errors.currentPassword && (
            <p className="text-[10px] text-red-600 font-bold ml-0.5 mt-0.5">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">New Password</label>
          <input
            {...register('newPassword')}
            type="password"
            className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs"
          />
          {errors.newPassword && (
            <p className="text-[10px] text-red-600 font-bold ml-0.5 mt-0.5">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Confirm New Password</label>
          <input
            {...register('confirmPassword')}
            type="password"
            className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs"
          />
          {errors.confirmPassword && (
            <p className="text-[10px] text-red-600 font-bold ml-0.5 mt-0.5">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="w-full mt-2"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
            </span>
          ) : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}
