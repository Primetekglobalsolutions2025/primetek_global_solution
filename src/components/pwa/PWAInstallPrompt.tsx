'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      const allowedRoutes = ['/employee/login', '/admin/login', '/employee/dashboard'];
      if (allowedRoutes.includes(pathname)) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, [pathname]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[100] w-[calc(100%-3rem)] sm:w-[320px]"
        >
          <div className="bg-white rounded-lg p-5 shadow-2xs border border-zinc-200 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl" />
            
            <div className="flex justify-between items-start mb-4 relative">
              <div className="w-9 h-9 rounded bg-primary-50 flex items-center justify-center text-primary-600">
                <Smartphone className="w-4 h-4" />
              </div>
              <button 
                onClick={() => setIsVisible(false)} 
                className="text-zinc-400 hover:text-navy-900 transition-colors p-1.5 bg-zinc-50 rounded border border-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="relative">
              <h3 className="font-sans font-bold text-navy-900 text-xs mb-1 uppercase tracking-wider">
                Install Portal App
              </h3>
              <p className="text-zinc-500 text-[11px] font-medium leading-relaxed mb-4">
                For a faster, app-like experience with quick access to your dashboard and notifications.
              </p>
              
              <Button 
                onClick={handleInstall}
                size="sm"
                className="w-full bg-navy-900 text-white hover:bg-navy-800 font-bold rounded-md py-2.5 border-0 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Add to Home Screen
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
