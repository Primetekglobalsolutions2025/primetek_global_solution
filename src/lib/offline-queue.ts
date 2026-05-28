/**
 * Offline Attendance Queue
 * 
 * Persists attendance actions (check-in, check-out, WFH) to localStorage
 * when the device is offline. Automatically syncs when connectivity returns.
 * Prevents duplicate submissions using date+employee deduplication.
 */

export interface OfflineAttendanceEntry {
  id: string;
  action: 'check_in' | 'check_out' | 'wfh_request';
  timestamp: string;
  lat: number;
  lng: number;
  fingerprint: string;
  recordId?: string; // for check_out only
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  errorMessage?: string;
}

const QUEUE_KEY = 'primetek_offline_attendance_queue';
const ARCHIVE_KEY = 'primetek_failed_attendance_history';

export interface ArchivedOfflineEntry {
  entry: OfflineAttendanceEntry;
  archivedAt: string;
  reason: string;
}

/** Get the archived failed history queue */
export function getArchivedOfflineQueue(): ArchivedOfflineEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Archive failed entries in localStorage */
function archiveEntries(items: { entry: OfflineAttendanceEntry; reason: string }[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    const archive: ArchivedOfflineEntry[] = raw ? JSON.parse(raw) : [];
    
    items.forEach(({ entry, reason }) => {
      if (!archive.some(a => a.entry.id === entry.id)) {
        archive.push({
          entry: { ...entry, status: 'failed' },
          archivedAt: new Date().toISOString(),
          reason
        });
      }
    });

    if (archive.length > 100) {
      archive.splice(0, archive.length - 100);
    }
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  } catch (err) {
    console.error('Failed to write to archive bucket:', err);
  }
}

/** Read the full queue from localStorage, filtering out and archiving expired/failed/orphaned entries */
export function getOfflineQueue(): OfflineAttendanceEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const queue: OfflineAttendanceEntry[] = JSON.parse(raw);

    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000; // 24 hours
    const maxRetries = 3;

    const activeEntries: OfflineAttendanceEntry[] = [];
    const entriesToArchive: { entry: OfflineAttendanceEntry; reason: string }[] = [];

    // First pass: basic TTL & retry count checks
    const activeSet = new Set<string>();
    for (const entry of queue) {
      const age = now - new Date(entry.timestamp).getTime();
      if (age > TTL) {
        entriesToArchive.push({ entry, reason: 'TTL_EXPIRED_24H' });
      } else if (entry.retryCount >= maxRetries) {
        entriesToArchive.push({ entry, reason: 'MAX_RETRIES_EXCEEDED' });
      } else {
        activeEntries.push(entry);
        activeSet.add(entry.id);
      }
    }

    // Second pass: orphan checkouts whose parent check-in failed or is missing
    const finalEntries: OfflineAttendanceEntry[] = [];
    for (const entry of activeEntries) {
      if (entry.action === 'check_out' && entry.recordId && entry.recordId.startsWith('offline_')) {
        if (!activeSet.has(entry.recordId)) {
          entriesToArchive.push({ entry, reason: 'ORPHANED_CHECKOUT_NO_PARENT' });
          continue;
        }
      }
      finalEntries.push(entry);
    }

    if (entriesToArchive.length > 0) {
      archiveEntries(entriesToArchive);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(finalEntries));
    }

    return finalEntries;
  } catch {
    return [];
  }
}

/** Persist the queue to localStorage */
function saveQueue(queue: OfflineAttendanceEntry[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Generate a unique ID for queue entries */
function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Calculate shift date (IST timezone, night shift) for client side deduplication */
function getClientShiftDate(dateStrOrObj: string | Date = new Date()): string {
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  // Convert UTC to IST (+5:30)
  const offset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + offset);
  
  // Read hours in IST
  const hours = istDate.getUTCHours();
  
  let shiftDateStr: string;
  if (hours < 12) {
    // Before noon IST, it belongs to yesterday's shift
    const yesterday = new Date(istDate.getTime() - 24 * 60 * 60 * 1000);
    shiftDateStr = yesterday.toISOString().split('T')[0];
  } else {
    // Noon or later IST, it belongs to today's shift
    shiftDateStr = istDate.toISOString().split('T')[0];
  }
  return shiftDateStr;
}

/** Add an entry to the offline queue */
export function enqueueOfflineAction(
  action: OfflineAttendanceEntry['action'],
  lat: number,
  lng: number,
  fingerprint: string,
  recordId?: string,
): OfflineAttendanceEntry {
  const entry: OfflineAttendanceEntry = {
    id: generateId(),
    action,
    timestamp: new Date().toISOString(),
    lat,
    lng,
    fingerprint,
    recordId,
    status: 'pending',
    retryCount: 0,
  };

  const queue = getOfflineQueue();

  // Duplicate prevention: block multiple check-ins/check-outs for the same shift date
  const shiftDate = getClientShiftDate(new Date());
  if (action === 'check_in' || action === 'wfh_request') {
    const hasDuplicate = queue.some(
      (e) =>
        (e.action === 'check_in' || e.action === 'wfh_request') &&
        getClientShiftDate(e.timestamp) === shiftDate &&
        e.status !== 'failed',
    );
    if (hasDuplicate) {
      throw new Error('A check-in for today is already queued offline.');
    }
  }

  if (action === 'check_out') {
    const hasDuplicate = queue.some(
      (e) =>
        e.action === 'check_out' &&
        getClientShiftDate(e.timestamp) === shiftDate &&
        e.status !== 'failed',
    );
    if (hasDuplicate) {
      throw new Error('A check-out for today is already queued offline.');
    }
  }

  queue.push(entry);
  saveQueue(queue);
  return entry;
}

/** Remove a specific entry from the queue */
export function removeFromQueue(entryId: string): void {
  const queue = getOfflineQueue().filter((e) => e.id !== entryId);
  saveQueue(queue);
}

/** Update the status of a queued entry */
export function updateQueueEntry(
  entryId: string,
  updates: Partial<Pick<OfflineAttendanceEntry, 'status' | 'retryCount' | 'errorMessage' | 'recordId'>>,
): void {
  const queue = getOfflineQueue().map((e) =>
    e.id === entryId ? { ...e, ...updates } : e,
  );
  saveQueue(queue);
}

/** Get the count of pending items */
export function getPendingCount(): number {
  return getOfflineQueue().filter((e) => e.status === 'pending' || e.status === 'failed').length;
}

/** Clear all synced entries from the queue */
export function clearSyncedEntries(): void {
  const queue = getOfflineQueue().filter((e) => e.status !== 'synced');
  saveQueue(queue);
}
