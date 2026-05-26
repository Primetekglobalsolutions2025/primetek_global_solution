'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogIn, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const [showMFA, setShowMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [lockout, setLockout] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      const res = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Invalid credentials');
        if (result.lockout) setLockout(true);
        if (result.showCaptcha) setShowCaptcha(true);
        return;
      }

      if (result.requiresMFA) {
        setShowMFA(true);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
 
    try {
      const res = await fetch('/api/auth/mfa-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid verification code');
        setVerifying(false);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('MFA verification failed');
      setVerifying(false);
    }
  };

  if (showMFA) {
    return (
      <form onSubmit={handleMFAVerify} className="space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary-500/10 text-primary-500 flex items-center justify-center mx-auto mb-4 border border-primary-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Two-Step Verification</h2>
          <p className="text-xs text-gray-400 font-medium">Please enter the security code from your device.</p>
        </div>

        <input
          type="text"
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
          placeholder="000 000"
          className="w-full px-5 py-5 rounded-2xl bg-white/5 border border-white/10 text-white text-center font-mono text-3xl font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          required
          autoFocus
        />

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <Button 
          type="submit" 
          size="lg" 
          className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl py-5" 
          disabled={verifying || mfaCode.length !== 6}
        >
          {verifying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Verify Code'}
        </Button>

        <button 
          type="button" 
          onClick={() => setShowMFA(false)} 
          className="w-full text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
        >
          Back to Login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
      {lockout && (
        <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-2 mb-6 animate-in slide-in-from-top-4">
          <p className="text-xs font-black text-red-400 uppercase tracking-widest">Account Locked</p>
          <p className="text-[11px] text-red-400/70 font-medium leading-relaxed">Too many failed login attempts. Your access is temporarily locked for 15 minutes.</p>
        </div>
      )}

      {error && !lockout && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center animate-in fade-in zoom-in duration-300">
          {error}
        </div>
      )}

      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="login-email" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
          Email Address
        </label>
        <div className="relative group">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="name@primetek.com"
            disabled={lockout}
            {...register('email')}
            className={cn(
              "w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm font-medium disabled:opacity-50",
              errors.email && "border-red-500/50 focus:ring-red-500/50"
            )}
          />
        </div>
        {errors.email && <p className="text-red-400 text-[10px] font-bold ml-1">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label htmlFor="login-password" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={lockout}
            {...register('password')}
            className={cn(
              "w-full px-5 py-4 pr-14 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm font-medium disabled:opacity-50",
              errors.password && "border-red-500/50 focus:ring-red-500/50"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-red-400 text-[10px] font-bold ml-1">{errors.password.message}</p>}
      </div>

      {showCaptcha && !lockout && (
        <div className="p-3 bg-primary-500/5 border border-primary-500/20 rounded-xl text-primary-200 text-[10px] font-bold uppercase tracking-widest text-center">
          Security Verification Required
        </div>
      )}

      {/* Submit */}
      <Button 
        type="submit" 
        size="lg" 
        className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl py-5 shadow-xl shadow-primary-500/20 border-0 active:scale-[0.98] transition-all" 
        disabled={isSubmitting || lockout}
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          <div className="flex items-center justify-center gap-2">
            <LogIn className="w-5 h-5" /> 
            <span>Sign In</span>
          </div>
        )}
      </Button>
    </form>
  );
}
