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
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Let the user continue their session uninterrupted on Service Worker update
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
      // Try to load session from sessionStorage first, then fallback to localStorage
      let currentSession = null;
      try {
        const savedSession = sessionStorage.getItem('primetek-employee-session');
        if (savedSession) {
          currentSession = JSON.parse(savedSession);
        } else {
          const fallbackSession = localStorage.getItem('primetek-employee-session');
          if (fallbackSession) {
            currentSession = JSON.parse(fallbackSession);
            // Sync fallback session back to sessionStorage
            sessionStorage.setItem('primetek-employee-session', fallbackSession);
          }
        }

        if (currentSession) {
          setSession(currentSession);
        }
      } catch (err) {
        console.warn('Error reading session from storage:', err);
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

      // If offline
      if (typeof window !== 'undefined' && !navigator.onLine) {
        if (currentSession) {
          setIsLoading(false);
          return;
        } else {
          // Both are empty and device is offline, redirect to login
          router.replace('/employee/login');
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
              sessionStorage.setItem('primetek-employee-session', JSON.stringify(data.user));
              localStorage.setItem('primetek-employee-session', JSON.stringify(data.user));
            } catch {}
          } else if (data.user?.role === 'admin') {
            router.replace('/admin/dashboard');
            return;
          } else {
            try {
              sessionStorage.removeItem('primetek-employee-session');
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
            sessionStorage.removeItem('primetek-employee-session');
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white gap-3">
        <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
        <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-mono font-semibold">Loading Portal</p>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="employee-portal fixed inset-0 flex bg-zinc-50 overflow-hidden">
      {/* Sidebar — desktop only */}
      {session && <div className="hidden md:flex"><AppSidebar role={session.role} userName={session.name} /></div>}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — desktop only */}
        <div className="hidden md:block"><AppHeader userName={session?.name} /></div>
        <main className="flex-1 overflow-y-auto md:p-6 md:pb-6">
          <div className="md:max-w-7xl md:mx-auto md:space-y-4">
            <div className="hidden md:block"><OfflineSyncBanner /></div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
