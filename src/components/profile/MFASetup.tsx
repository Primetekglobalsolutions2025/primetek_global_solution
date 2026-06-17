'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, QrCode, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Image from 'next/image';

interface MFASetupProps {
  initialEnabled: boolean;
}

export default function MFASetup({ initialEnabled }: MFASetupProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mfa/setup');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSetupData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setSuccess(true);
      setEnabled(true);
      setSetupData(null);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
            {enabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h4 className="text-sm font-black text-navy-900 uppercase tracking-widest">Multi-Factor Authentication</h4>
            <p className="text-[11px] text-text-muted font-bold">{enabled ? 'ENABLED' : 'NOT ENABLED'}</p>
          </div>
        </div>
        
        {!enabled && !setupData && (
          <Button onClick={startSetup} disabled={loading} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
            Enable MFA
          </Button>
        )}
      </div>

      {setupData && (
        <div className="bg-surface-alt rounded-2xl p-6 border border-border animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="bg-white p-4 rounded-2xl border border-border shadow-sm">
              <Image src={setupData.qrCode} alt="MFA QR Code" width={160} height={160} className="rounded-lg" />
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <p className="text-xs font-bold text-navy-900 mb-1">1. Scan QR Code</p>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Open your authenticator app (Google Authenticator, Authy, Microsoft Authenticator) and scan this code.
                </p>
              </div>
              <div className="pt-2">
                <p className="text-xs font-bold text-navy-900 mb-2">2. Enter Verification Code</p>
                <div className="flex gap-2 justify-center md:justify-start">
                  <input 
                    type="text" 
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    placeholder="000000"
                    className="w-32 px-4 py-2 rounded-xl border border-border bg-white text-center font-mono font-bold tracking-widest focus:ring-2 focus:ring-primary-400 focus:outline-none"
                  />
                  <Button onClick={verifyMFA} disabled={verificationCode.length !== 6 || verifying}>
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {error && <p className="mt-4 text-xs text-red-500 font-bold text-center md:text-left">{error}</p>}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 text-emerald-600 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-xs font-bold">MFA enabled successfully! Your account is now more secure.</p>
        </div>
      )}

      {enabled && !setupData && (
        <p className="text-[11px] text-text-muted font-medium italic">
          Your account is protected by an additional security layer. You will need to provide a code from your authenticator app when logging in.
        </p>
      )}
    </div>
  );
}
