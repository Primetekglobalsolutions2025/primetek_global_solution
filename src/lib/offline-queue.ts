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

/** Read the full queue from localStorage */
export function getOfflineQueue(): OfflineAttendanceEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
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

  // Duplicate prevention: block multiple check-ins for the same shift date
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
  updates: Partial<Pick<OfflineAttendanceEntry, 'status' | 'retryCount' | 'errorMessage'>>,
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
