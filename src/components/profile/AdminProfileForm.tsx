'use client';

import { useState } from 'react';
import { User, Mail, Shield, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { updateAdminProfile } from '@/app/admin/profile/actions';
import Button from '@/components/ui/Button';

export default function AdminProfileForm({ 
  initialName, 
  email, 
  role 
}: { 
  initialName: string; 
  email: string; 
  role: string; 
}) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || name.trim() === '') return;

    setStatus('loading');
    setErrorMsg('');
    try {
      await updateAdminProfile({ name });
      setStatus('success');
      // Force reload page / route to let layout see the updated session cookie
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to update profile name';
      setErrorMsg(message);
    }
  };

  return (
    <div className="space-y-4">
      {status === 'success' && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-700 text-xs mb-4 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="font-semibold">Profile updated successfully! Refreshing session...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2.5 text-red-700 text-xs mb-4 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Full Name</label>
          <div className="relative flex items-center">
            <User className="absolute left-3 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Email Address</label>
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-zinc-50 border border-zinc-200/80 cursor-not-allowed">
            <Mail className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-550 select-none">{email}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Access Role</label>
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary-500/10 border border-primary-500/20 cursor-not-allowed">
            <Shield className="w-3.5 h-3.5 text-primary-600" />
            <span className="text-xs font-bold text-primary-750 uppercase tracking-wider select-none">{role}</span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="w-full mt-2"
          disabled={status === 'loading' || name.trim() === initialName}
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
            </span>
          ) : 'Save Profile Name'}
        </Button>
      </form>
    </div>
  );
}
