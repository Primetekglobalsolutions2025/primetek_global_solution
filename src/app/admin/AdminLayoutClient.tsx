'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppSidebar from '@/components/pwa/AppSidebar';
import AppHeader from '@/components/pwa/AppHeader';
import { Loader2 } from 'lucide-react';
import OfflineSyncBanner from '@/components/pwa/OfflineSyncBanner';

export default function AdminLayoutClient({ children, initialPendingCount }: { children: React.ReactNode, initialPendingCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ role: 'admin' | 'employee' | 'hr'; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(initialPendingCount || 0);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (initialPendingCount !== undefined) {
      setPendingCount(initialPendingCount);
    }
  }, [initialPendingCount]);

  useEffect(() => {
    if (!session || session.role !== 'admin') return;

    const fetchPendingCount = async () => {
      try {
        const { getPendingCountOnly } = await import('@/app/admin/approvals/actions');
        const count = await getPendingCountOnly();
        setPendingCount(count);
      } catch (err) {
        console.warn('Failed to fetch pending counts for layout', err);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 25000);
    return () => clearInterval(interval);
  }, [session]);

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
      // Try to load session from sessionStorage
      let currentSession = null;
      try {
        const savedSession = sessionStorage.getItem('primetek-admin-session');
        if (savedSession) {
          currentSession = JSON.parse(savedSession);
          setSession(currentSession);
        }
      } catch (err) {
        console.warn('Error reading session from sessionStorage:', err);
      }

      if (isLoginPage) {
        try {
          const res = await fetch('/api/auth/me?role=admin');
          if (res.ok) {
            const data = await res.json();
            if (data.user?.role === 'admin') {
              router.replace('/admin/dashboard');
              return;
            } else if (data.user?.role === 'employee' || data.user?.role === 'hr') {
              router.replace('/employee/dashboard');
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
        const res = await fetch('/api/auth/me?role=admin');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === 'admin') {
            setSession(data.user);
            try {
              sessionStorage.setItem('primetek-admin-session', JSON.stringify(data.user));
            } catch {}
          } else if (data.user?.role === 'employee' || data.user?.role === 'hr') {
            router.replace('/employee/dashboard');
            return;
          } else {
            try {
              sessionStorage.removeItem('primetek-admin-session');
              localStorage.removeItem('primetek-admin-token');
            } catch {}
            setSession(null);
            router.replace('/admin/login');
            return;
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Genuine unauthenticated response
          try {
            sessionStorage.removeItem('primetek-admin-session');
            localStorage.removeItem('primetek-admin-token');
          } catch {}
          setSession(null);
          router.replace('/admin/login');
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

  // Handle hash scrolling on client-side navigation (e.g. settings#notifications, audit#activity)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    let attempts = 0;
    const maxAttempts = 10;
    const intervalTime = 150;

    const tryScroll = () => {
      const id = window.location.hash.replace('#', '');
      if (!id) return false;
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };

    // Try immediately
    if (tryScroll()) return;

    // Retry if element is not in DOM yet (e.g. during client-side dynamic load)
    const interval = setInterval(() => {
      attempts++;
      if (tryScroll() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, intervalTime);

    const handleHashChange = () => {
      tryScroll();
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [pathname]);


  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-50 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-xl shadow-primary-500/30">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Loading Portal</p>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="admin-portal fixed inset-0 flex bg-zinc-50 text-navy-900 overflow-hidden font-sans">
      {session && (
        <AppSidebar 
          role={session.role} 
          userName={session.name} 
          initialPendingCount={initialPendingCount} 
          pendingCount={pendingCount} 
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50">
        <AppHeader userName={session?.name} role={session?.role} notificationCount={session?.role === 'admin' ? pendingCount : 0} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <OfflineSyncBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
