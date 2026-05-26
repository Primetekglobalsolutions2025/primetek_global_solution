'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppSidebar from '@/components/pwa/AppSidebar';
import AppHeader from '@/components/pwa/AppHeader';
import { Loader2 } from 'lucide-react';
import OfflineSyncBanner from '@/components/pwa/OfflineSyncBanner';

export default function EmployeeLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ role: 'admin' | 'employee' | 'hr'; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isLoginPage = pathname === '/employee/login';

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        })
        .catch((err) => console.log('SW registration failed:', err));
    }

    const checkAuth = async () => {
      // Try to load session from localStorage
      let currentSession = null;
      try {
        const savedSession = localStorage.getItem('primetek-employee-session');
        if (savedSession) {
          currentSession = JSON.parse(savedSession);
          setSession(currentSession);
        }
      } catch (err) {
        console.warn('Error reading session from localStorage:', err);
      }

      if (isLoginPage) {
        try {
          const res = await fetch('/api/auth/me?role=employee');
          if (res.ok) {
            const data = await res.json();
            if (data.user?.role === 'employee' || data.user?.role === 'hr') {
              router.replace('/employee/dashboard');
              return;
            } else if (data.user?.role === 'admin') {
              router.replace('/admin/dashboard');
              return;
            }
          }
        } catch {}
        setIsLoading(false);
        return;
      }

      // If offline, keep the local session (if exists) and don't redirect
      if (typeof window !== 'undefined' && !navigator.onLine) {
        if (currentSession) {
          setIsLoading(false);
          return;
        }
      }

      try {
        const res = await fetch('/api/auth/me?role=employee');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === 'employee' || data.user?.role === 'hr') {
            setSession(data.user);
            try {
              localStorage.setItem('primetek-employee-session', JSON.stringify(data.user));
            } catch {}
          } else if (data.user?.role === 'admin') {
            router.replace('/admin/dashboard');
            return;
          } else {
            try {
              localStorage.removeItem('primetek-employee-session');
              localStorage.removeItem('primetek-employee-token');
            } catch {}
            setSession(null);
            router.replace('/employee/login');
            return;
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Genuine unauthenticated response
          try {
            localStorage.removeItem('primetek-employee-session');
            localStorage.removeItem('primetek-employee-token');
          } catch {}
          setSession(null);
          router.replace('/employee/login');
          return;
        } else {
          // Server errors (500, 502, etc.) -> keep local session, do not redirect
          console.warn(`Auth check received server status ${res.status}. Session retained.`);
        }
      } catch (err) {
        // Network/fetch error -> keep local session, do not redirect
        console.warn('Network error during auth verification. Session retained:', err);
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
          <div className="max-w-7xl mx-auto space-y-4">
            <OfflineSyncBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
