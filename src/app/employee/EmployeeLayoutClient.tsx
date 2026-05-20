'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppSidebar from '@/components/pwa/AppSidebar';
import AppHeader from '@/components/pwa/AppHeader';
import { Loader2 } from 'lucide-react';

export default function EmployeeLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ role: 'admin' | 'employee'; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isLoginPage = pathname === '/employee/login';

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/employee/' })
        .catch((err) => console.log('SW registration failed:', err));
    }

    const checkAuth = async () => {
      if (isLoginPage) {
        setIsLoading(false);
        return;
      }

      if (session) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setSession(data.user);
        } else {
          router.replace('/employee/login');
        }
      } catch {
        router.replace('/employee/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, isLoginPage]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-navy-900 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-xl shadow-primary-500/30">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
        <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">Loading Portal</p>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] bg-surface-alt overflow-hidden">
      {session && <AppSidebar role={session.role} userName={session.name} />}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader userName={session?.name} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
