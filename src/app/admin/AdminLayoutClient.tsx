'use client';

import { useEffect, useState, Suspense, use } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppSidebar from '@/components/pwa/AppSidebar';
import AppHeader from '@/components/pwa/AppHeader';
import { Loader2 } from 'lucide-react';
import OfflineSyncBanner from '@/components/pwa/OfflineSyncBanner';
import { NotificationProvider } from '@/components/pwa/NotificationContext';

function PendingCountResolver({
  promise,
  onResolve
}: {
  promise: Promise<number>;
  onResolve: (val: number) => void;
}) {
  const count = use(promise);
  useEffect(() => {
    onResolve(count);
  }, [count, onResolve]);
  return null;
}

export default function AdminLayoutClient({
  children,
  pendingCountPromise
}: {
  children: React.ReactNode,
  pendingCountPromise?: Promise<number>
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ id: string; role: 'admin' | 'employee' | 'hr'; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const isLoginPage = pathname === '/admin/login';

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
    if (!session || session.role !== 'admin') return;
 
    const checkAndPromptNotifications = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
 
      const permission = Notification.permission;
 
      // If already granted, sync subscription silently in the background
      if (permission === 'granted') {
        try {
          const { subscribeUserToPush } = await import('@/lib/notifications/push-helper');
          await subscribeUserToPush();
        } catch (err) {
          console.warn('Failed to sync existing push subscription:', err);
        }
        return;
      }
 
      // If default (never prompted), prompt once
      if (permission === 'default') {
        const hasPrompted = localStorage.getItem('primetek-admin-notif-prompted');
        if (!hasPrompted) {
          localStorage.setItem('primetek-admin-notif-prompted', 'true');
          try {
            const { subscribeUserToPush } = await import('@/lib/notifications/push-helper');
            await subscribeUserToPush();
          } catch (err) {
            console.warn('Failed to register new push subscription:', err);
          }
        }
      }
    };
 
    // Delay prompt by 2 seconds to let the dashboard finish loading smoothly
    const timer = setTimeout(checkAndPromptNotifications, 2000);
    return () => clearTimeout(timer);
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
      // Try to load session from sessionStorage first, then fallback to localStorage
      let currentSession = null;
      try {
        const savedSession = sessionStorage.getItem('primetek-admin-session');
        if (savedSession) {
          currentSession = JSON.parse(savedSession);
        } else {
          const fallbackSession = localStorage.getItem('primetek-admin-session');
          if (fallbackSession) {
            currentSession = JSON.parse(fallbackSession);
            // Sync fallback session back to sessionStorage
            sessionStorage.setItem('primetek-admin-session', fallbackSession);
          }
        }

        if (currentSession) {
          setSession(currentSession);
        }
      } catch (err) {
        console.warn('Error reading session from storage:', err);
      }

      if (isLoginPage) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch('/api/auth/me?role=admin', { signal: controller.signal });
          clearTimeout(timeoutId);
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
        } catch {
          clearTimeout(timeoutId);
        }
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
          router.replace('/admin/login');
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('/api/auth/me?role=admin', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === 'admin') {
            setSession(data.user);
            try {
              sessionStorage.setItem('primetek-admin-session', JSON.stringify(data.user));
              localStorage.setItem('primetek-admin-session', JSON.stringify(data.user));
            } catch {}
          } else if (data.user?.role === 'employee' || data.user?.role === 'hr') {
            router.replace('/employee/dashboard');
            return;
          } else {
            try {
              sessionStorage.removeItem('primetek-admin-session');
              localStorage.removeItem('primetek-admin-session');
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
            localStorage.removeItem('primetek-admin-session');
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
        clearTimeout(timeoutId);
        // Network/fetch error -> keep local session, do not redirect
        console.warn('Network/timeout error during auth verification. Session retained:', err);
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
    <NotificationProvider employeeId={session?.id} role={session?.role}>
      <div className="admin-portal fixed inset-0 flex bg-zinc-50 text-navy-900 overflow-hidden font-sans">
        {pendingCountPromise && (
          <Suspense fallback={null}>
            <PendingCountResolver promise={pendingCountPromise} onResolve={setPendingCount} />
          </Suspense>
        )}
        {session && (
          <AppSidebar 
            role={session.role} 
            userName={session.name} 
            pendingCount={pendingCount} 
          />
        )}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-50 overflow-x-hidden">
          <AppHeader userName={session?.name} role={session?.role} notificationCount={session?.role === 'admin' ? pendingCount : 0} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-6 md:p-6 md:pt-8 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6 scroll-smooth scrollbar-none">
            <div className="max-w-7xl mx-auto space-y-4">
              <OfflineSyncBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
