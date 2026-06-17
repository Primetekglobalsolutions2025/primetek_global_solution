'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOfflineQueue,
  getPendingCount,
  updateQueueEntry,
  removeFromQueue,
  clearSyncedEntries,
} from '@/lib/offline-queue';
import { checkIn, requestWFH, startBreak, endBreak, submitOfflineRecoveryRequest } from '@/app/employee/attendance/actions';

const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<'success' | 'partial' | 'failed' | null>(null);

  // Sync all pending entries with the server
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    // getOfflineQueue automatically filters out and archives entries exceeding TTL, retry caps, or checkout orphans
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
        await submitOfflineRecoveryRequest(
          entry.action,
          entry.timestamp,
          entry.lat,
          entry.lng,
          entry.fingerprint,
          entry.errorMessage || 'Max retries exceeded'
        );
        removeFromQueue(entry.id);
        failCount++;
        continue;
      }

      updateQueueEntry(entry.id, { status: 'syncing' });

      try {
        let result: { success: boolean; error?: string; recordId?: string };

        switch (entry.action) {
          case 'check_in':
            result = await checkIn(
              entry.lat,
              entry.lng,
              undefined,
              undefined,
              entry.fingerprint,
              entry.timestamp,
              undefined,
              undefined,
              true // isOfflineSync
            );
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
              result = await submitOfflineRecoveryRequest(
                'check_out',
                entry.timestamp,
                entry.lat,
                entry.lng,
                entry.fingerprint,
                'Offline Clock-out Sync'
              );
            }
            break;
          case 'wfh_request':
            result = await requestWFH(
              entry.lat,
              entry.lng,
              undefined,
              undefined,
              entry.fingerprint,
              entry.timestamp,
              true // isOfflineSync
            );
            if (result.success && result.recordId) {
              const queue = getOfflineQueue();
              const checkoutEntry = queue.find(e => e.action === 'check_out' && e.recordId === entry.id);
              if (checkoutEntry) {
                updateQueueEntry(checkoutEntry.id, { recordId: result.recordId });
              }
            }
            break;
          case 'break_start':
            result = await startBreak();
            break;
          case 'break_end':
            result = await endBreak();
            break;
          default:
            result = { success: false, error: 'Unknown action' };
        }

        if (result.success) {
          updateQueueEntry(entry.id, { status: 'synced' });
          successCount++;
        } else {
          const nextRetry = entry.retryCount + 1;
          if (nextRetry >= MAX_RETRIES) {
            await submitOfflineRecoveryRequest(
              entry.action,
              entry.timestamp,
              entry.lat,
              entry.lng,
              entry.fingerprint,
              result.error || 'Sync failed'
            );
            removeFromQueue(entry.id);
          } else {
            updateQueueEntry(entry.id, {
              status: 'failed',
              retryCount: nextRetry,
              errorMessage: result.error || 'Sync failed',
            });
          }
          failCount++;
        }
      } catch (err) {
        const nextRetry = entry.retryCount + 1;
        const errStr = err instanceof Error ? err.message : 'Network error during sync';
        if (nextRetry >= MAX_RETRIES) {
          await submitOfflineRecoveryRequest(
            entry.action,
            entry.timestamp,
            entry.lat,
            entry.lng,
            entry.fingerprint,
            errStr
          );
          removeFromQueue(entry.id);
        } else {
          updateQueueEntry(entry.id, {
            status: 'failed',
            retryCount: nextRetry,
            errorMessage: errStr,
          });
        }
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
    setTimeout(() => setLastSyncResult(null), 8000);
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

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGERED') {
        syncQueue();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
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
