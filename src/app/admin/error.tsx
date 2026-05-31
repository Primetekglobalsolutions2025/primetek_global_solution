'use client';

import { useEffect } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin portal route error captured:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-sm shadow-red-500/5">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900 mb-2">
        System Runtime Exception
      </h1>
      
      <p className="text-sm text-zinc-550 max-w-md mb-8 leading-relaxed">
        The admin portal encountered an unexpected runtime error. This might be due to a network interruption or stale query parameters.
      </p>

      {error.message && (
        <div className="bg-red-50/50 border border-red-200/50 text-[11px] font-mono text-red-700/80 px-4 py-2.5 rounded-lg mb-8 max-w-lg overflow-x-auto text-left leading-relaxed">
          Error: {error.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
        <Button
          onClick={() => reset()}
          className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-bold px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md shadow-primary-500/10 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Attempt Re-render</span>
        </Button>
        <Button
          onClick={() => window.location.href = '/admin/dashboard'}
          variant="outline"
          className="w-full sm:w-auto px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs text-navy-900 border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-95 transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Button>
      </div>
    </div>
  );
}
