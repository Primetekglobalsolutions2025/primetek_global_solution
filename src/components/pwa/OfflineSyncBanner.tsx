'use client';

import { useState, useEffect } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export default function OfflineSyncBanner() {
  const { isOnline, pendingCount, isSyncing, syncQueue, lastSyncResult } = useOfflineSync();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (lastSyncResult === 'success') {
      setShowSuccess(true);
    } else {
      setShowSuccess(false);
    }
  }, [lastSyncResult]);

  useEffect(() => {
    if (!showSuccess) return;

    const handleInteraction = () => {
      setShowSuccess(false);
    };

    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleInteraction);
      window.addEventListener('touchstart', handleInteraction);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [showSuccess]);

  const showBanner = !isOnline || pendingCount > 0 || showSuccess || (lastSyncResult !== null && lastSyncResult !== 'success');

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full"
      >
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-xs font-medium shadow-sm transition-all duration-200',
            !isOnline
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
              : isSyncing
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-800'
              : showSuccess
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-800'
          )}
        >
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Offline Mode — Actions will queue locally</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Syncing attendance queue...</span>
              </>
            ) : showSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>All attendance synchronized successfully</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-blue-600 animate-pulse" />
                <span>
                  {pendingCount} pending action{pendingCount > 1 ? 's' : ''} queued offline
                </span>
              </>
            )}
          </div>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                syncQueue();
              }}
              disabled={isSyncing}
              className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
