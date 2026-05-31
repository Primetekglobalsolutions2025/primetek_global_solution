'use client';

import { useState, useEffect } from 'react';
import { Bell, X, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNotificationPermissionState, subscribeUserToPush } from '@/lib/notifications/push-helper';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';

export default function PushPermissionPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Only run on client side and check permission state
    if (typeof window === 'undefined') return;

    const state = getNotificationPermissionState();
    const isDismissed = localStorage.getItem('primetek_push_prompt_dismissed') === 'true';

    // Show if permission is 'default' and not dismissed recently
    if (state === 'default' && !isDismissed) {
      // Delay display slightly for better UX (not showing immediately on first paint)
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAllow = async () => {
    setIsSubscribing(true);
    const res = await subscribeUserToPush();
    setIsSubscribing(false);

    if (res.success) {
      toast.success('Push notifications enabled successfully.');
      setIsVisible(false);
    } else {
      toast.error(res.error || 'Failed to enable push notifications.');
      // Dismiss for now on error so we don't spam the user
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('primetek_push_prompt_dismissed', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-6 z-[100] w-[calc(100%-3rem)] sm:w-[360px]"
        >
          <div className="bg-navy-900 text-white rounded-lg p-5 shadow-2xl border border-navy-800 relative overflow-hidden">
            {/* Ambient background blur highlights */}
            <div className="absolute -top-12 -left-12 w-28 h-28 bg-primary-500/10 rounded-full blur-xl" />
            <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl" />

            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center text-primary-300">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <button
                onClick={handleDismiss}
                className="text-zinc-400 hover:text-white transition-colors p-1 bg-white/5 rounded border border-white/10 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative z-10">
              <h3 className="font-sans font-bold text-white text-xs mb-1 uppercase tracking-wider">
                Enable Portal Alerts
              </h3>
              <p className="text-zinc-400 text-[11px] font-medium leading-relaxed mb-4">
                Get instant notifications on leave approvals, daily report reminders, and company announcements directly in your device notification tray.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={handleAllow}
                  disabled={isSubscribing}
                  size="sm"
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-md py-2 border-0 shadow-2xs text-[11px]"
                >
                  {isSubscribing ? 'Enabling...' : 'Allow Notifications'}
                </Button>
                <Button
                  onClick={handleDismiss}
                  size="sm"
                  variant="outline"
                  className="bg-transparent hover:bg-white/5 text-zinc-300 border border-white/10 rounded-md py-2 text-[11px]"
                >
                  Later
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
