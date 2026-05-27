'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOfflineQueue,
  getPendingCount,
  updateQueueEntry,
  removeFromQueue,
  clearSyncedEntries,
  type OfflineAttendanceEntry,
} from '@/lib/offline-queue';
import { checkIn, checkOut, requestWFH } from '@/app/employee/attendance/actions';

const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<'success' | 'partial' | 'failed' | null>(null);

  // Sync all pending entries with the server
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queue = getOfflineQueue();
    const pending = queue.filter((e) => e.status === 'pending' || e.status === 'failed');

    if (pending.length === 0) {
      setPendingCount(0);
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const entry of pending) {
      if (entry.retryCount >= MAX_RETRIES) {
        failCount++;
        continue;
      }

      updateQueueEntry(entry.id, { status: 'syncing' });

      try {
        let result: { success: boolean; error?: string; recordId?: string };

        switch (entry.action) {
          case 'check_in':
            result = await checkIn(entry.lat, entry.lng, undefined, undefined, entry.fingerprint, entry.timestamp);
            if (result.success && result.recordId) {
              const queue = getOfflineQueue();
              const checkoutEntry = queue.find(e => e.action === 'check_out' && e.recordId === entry.id);
              if (checkoutEntry) {
                updateQueueEntry(checkoutEntry.id, { recordId: result.recordId });
              }
            }
            break;
          case 'check_out':
            // Read latest entry from localStorage to get updated recordId
            const latestEntry = getOfflineQueue().find(e => e.id === entry.id);
            const targetRecordId = latestEntry?.recordId || entry.recordId;
            if (!targetRecordId) {
              result = { success: false, error: 'Missing record ID for checkout' };
            } else if (targetRecordId.startsWith('offline_')) {
              result = { success: false, error: 'Dependent check-in is not yet synced' };
            } else {
              result = await checkOut(targetRecordId, entry.lat, entry.lng, undefined, undefined, entry.fingerprint);
            }
            break;
          case 'wfh_request':
            result = await requestWFH(entry.lat, entry.lng, undefined, undefined, entry.fingerprint, entry.timestamp);
            if (result.success && result.recordId) {
              const queue = getOfflineQueue();
              const checkoutEntry = queue.find(e => e.action === 'check_out' && e.recordId === entry.id);
              if (checkoutEntry) {
                updateQueueEntry(checkoutEntry.id, { recordId: result.recordId });
              }
            }
            break;
          default:
            result = { success: false, error: 'Unknown action' };
        }

        if (result.success) {
          updateQueueEntry(entry.id, { status: 'synced' });
          successCount++;
        } else {
          updateQueueEntry(entry.id, {
            status: 'failed',
            retryCount: entry.retryCount + 1,
            errorMessage: result.error || 'Sync failed',
          });
          failCount++;
        }
      } catch {
        updateQueueEntry(entry.id, {
          status: 'failed',
          retryCount: entry.retryCount + 1,
          errorMessage: 'Network error during sync',
        });
        failCount++;
      }
    }

    // Clean up synced entries
    clearSyncedEntries();

    setPendingCount(getPendingCount());
    setIsSyncing(false);

    if (failCount === 0 && successCount > 0) {
      setLastSyncResult('success');
    } else if (successCount > 0 && failCount > 0) {
      setLastSyncResult('partial');
    } else if (failCount > 0) {
      setLastSyncResult('failed');
    }

    // Clear the result indicator after a delay
    setTimeout(() => setLastSyncResult(null), 5000);
  }, []);

  // Track online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    setPendingCount(getPendingCount());

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);


  const dismissEntry = useCallback((entryId: string) => {
    removeFromQueue(entryId);
    setPendingCount(getPendingCount());
  }, []);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getPendingCount());
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    syncQueue,
    dismissEntry,
    refreshPendingCount,
  };
}
