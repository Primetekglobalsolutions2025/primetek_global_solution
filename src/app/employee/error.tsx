'use client';

import { useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Employee Portal Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70dvh] px-6">
      <Card hover={false} className="max-w-md w-full p-8 text-center rounded-[2.5rem] border-0 shadow-2xl shadow-navy-900/10 relative overflow-hidden bg-white">
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-red-50 rounded-full blur-3xl opacity-60" />

        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl font-sans font-black text-navy-900 mb-2">Portal Error</h2>
          <p className="text-zinc-500 text-xs mb-8 leading-relaxed px-4">
            We had trouble loading this section. Your data is safe, but we need to restart the session.
          </p>

          <div className="space-y-3">
            <Button 
              variant="primary" 
              fullWidth 
              onClick={reset}
              className="rounded-xl h-11"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh Section
            </Button>
            
            <Link href="/employee/dashboard" className="w-full block">
              <Button 
                variant="outline" 
                fullWidth 
                className="rounded-xl h-11 border-border/60"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" /> My Dashboard
              </Button>
            </Link>
          </div>
          
          <p className="mt-8 text-[9px] font-bold text-text-muted uppercase tracking-[0.2em]">
            SYSTEM_ERROR_LOGGED
          </p>
        </div>
      </Card>
    </div>
  );
}
