'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function PWAStandaloneGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Detect standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || (navigator as any).standalone;

    if (isStandalone) {
      document.body.classList.add('pwa-standalone');
      
      // If user tries to access website pages while in standalone app, redirect to appropriate login portal
      const isPortalRoute = pathname.startsWith('/admin') || pathname.startsWith('/employee');
      
      if (!isPortalRoute) {
        let role = 'admin';
        try {
          const saved = localStorage.getItem('primetek-session');
          if (saved) {
            const user = JSON.parse(saved);
            if (user?.role === 'employee' || user?.role === 'hr') {
              role = 'employee';
            }
          }
        } catch {}
        router.replace(role === 'admin' ? '/admin/login' : '/employee/login');
      }
    } else {
      document.body.classList.remove('pwa-standalone');
    }
  }, [pathname, router]);

  return null;
}
