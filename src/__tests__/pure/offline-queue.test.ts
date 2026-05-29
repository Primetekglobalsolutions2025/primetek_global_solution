// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enqueueOfflineAction,
  getOfflineQueue,
  getArchivedOfflineQueue,
  updateQueueEntry,
  removeFromQueue,
  clearSyncedEntries,
} from '@/lib/offline-queue';

describe('Offline Attendance Queue — offline-queue.ts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('enqueueOfflineAction() and duplicate checks', () => {
    it('enqueues check_in successfully with status pending', () => {
      const entry = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      expect(entry.action).toBe('check_in');
      expect(entry.status).toBe('pending');
      expect(entry.lat).toBe(17.385);
      expect(entry.lng).toBe(78.4867);
      
      const queue = getOfflineQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(entry.id);
    });

    it('blocks duplicate check_in on the same shift date', () => {
      enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      expect(() => {
        enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      }).toThrow('already queued offline');
    });

    it('enqueues check_out successfully', () => {
      const entry = enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp');
      expect(entry.action).toBe('check_out');
    });

    it('blocks duplicate check_out on the same shift date', () => {
      enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp');
      expect(() => {
        enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp');
      }).toThrow('already queued offline');
    });

    it('allows a check_in if the previous check_in has status failed', () => {
      const entry = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      updateQueueEntry(entry.id, { status: 'failed' });
      
      // Now a new check_in should be enqueued without duplicate errors
      const newEntry = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      expect(newEntry.id).not.toBe(entry.id);
    });
  });

  describe('getOfflineQueue() TTL and cleanup', () => {
    it('preserves entries under 72h, removes and archives those over 72h', () => {
      const entry1 = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      const entry2 = enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp');
      
      // Artificially modify timestamps in localStorage to test TTL
      const queue = getOfflineQueue();
      const now = Date.now();
      
      // Make entry 1 be 71 hours old
      queue[0].timestamp = new Date(now - 71 * 60 * 60 * 1000).toISOString();
      // Make entry 2 be 73 hours old
      queue[1].timestamp = new Date(now - 73 * 60 * 60 * 1000).toISOString();
      
      localStorage.setItem('primetek_offline_attendance_queue', JSON.stringify(queue));
      
      const updatedQueue = getOfflineQueue();
      expect(updatedQueue.length).toBe(1);
      expect(updatedQueue[0].id).toBe(entry1.id);
      
      const archived = getArchivedOfflineQueue();
      expect(archived.length).toBe(1);
      expect(archived[0].entry.id).toBe(entry2.id);
      expect(archived[0].reason).toBe('TTL_EXPIRED_24H');
    });

    it('archives entries that exceed 3 retries', () => {
      const entry = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      updateQueueEntry(entry.id, { retryCount: 3 });
      
      const queue = getOfflineQueue();
      expect(queue.length).toBe(0);
      
      const archived = getArchivedOfflineQueue();
      expect(archived.length).toBe(1);
      expect(archived[0].entry.id).toBe(entry.id);
      expect(archived[0].reason).toBe('MAX_RETRIES_EXCEEDED');
    });

    it('archives orphaned check_out entries', () => {
      // check_out pointing to an offline check_in parent id
      const checkout = enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp', 'offline_parent_id');
      
      // Since no offline_parent_id is in the queue, it is orphaned and should be archived
      const queue = getOfflineQueue();
      expect(queue.length).toBe(0);
      
      const archived = getArchivedOfflineQueue();
      expect(archived.length).toBe(1);
      expect(archived[0].entry.id).toBe(checkout.id);
      expect(archived[0].reason).toBe('ORPHANED_CHECKOUT_NO_PARENT');
    });
  });

  describe('Queue ordering and state changes', () => {
    it('returns check_in before check_out when enqueued in order', () => {
      const entry1 = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      const entry2 = enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp', entry1.id);
      
      const queue = getOfflineQueue();
      expect(queue.length).toBe(2);
      expect(queue[0].action).toBe('check_in');
      expect(queue[1].action).toBe('check_out');
    });

    it('clears synced entries correctly', () => {
      const entry1 = enqueueOfflineAction('check_in', 17.385, 78.4867, 'test-fp');
      const entry2 = enqueueOfflineAction('check_out', 17.385, 78.4867, 'test-fp', entry1.id);
      
      updateQueueEntry(entry1.id, { status: 'synced' });
      // Simulate real client updating checkout's parent recordId to database UUID
      updateQueueEntry(entry2.id, { recordId: 'database-uuid-12345' });
      clearSyncedEntries();
      
      const queue = getOfflineQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(entry2.id);
      expect(queue[0].recordId).toBe('database-uuid-12345');
    });
  });
});
