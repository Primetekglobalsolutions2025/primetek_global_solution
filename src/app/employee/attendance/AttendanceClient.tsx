'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, LogIn, LogOut, Loader2, Home, AlertCircle, X, Sparkles, History, Calendar as CalendarIcon, Clock, Info, WifiOff, RefreshCw, AlertTriangle, Coffee, ShieldAlert, MapPin, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDistance, getISTShiftDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { checkIn, checkOut, resumeSession, requestWFH, startBreak, endBreak, getLateLoginsStats, processHeartbeat, getAttendanceSessionState, logGPSDismissEvent, submitDispute, getEmployeeDisputes, logStatusTransitionEvent, moveActiveSession, getAttendanceForMonth } from './actions';
import { getOrCreateFingerprint } from '@/lib/security/client-fingerprint';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { enqueueOfflineAction, getOfflineQueue } from '@/lib/offline-queue';
import { getDeviceInfo } from '@/lib/security/device-detect';



export interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_raw: string | null;
  duration_hours: number;
  status: string;
  total_break_seconds?: number;
  current_break_start?: string | null;
  awaiting_desktop_deadline?: string | null;
  device_type?: string | null;
  device_label?: string | null;
  productive_hours?: number;
}

export interface EmployeeDispute {
  id: string;
  attendance_id: string;
  employee_id: string;
  category: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  justification?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}


export interface Holiday {
  id: string;
  title: string;
  date: string;
  type: 'Company Holiday' | 'Optional Holiday' | 'Public Holiday';
}

export default function AttendanceClient({ 
  employeeId, 
  initialRecords, 
  wasAutoLoggedOut = false,
  initialHolidays = []
}: { 
  employeeId: string; 
  initialRecords: AttendanceRecord[]; 
  wasAutoLoggedOut?: boolean;
  initialHolidays?: Holiday[];
}) {
  const [holidays] = useState<Holiday[]>(initialHolidays);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [wfhRequest, setWfhRequest] = useState<{ active: boolean; distance?: number; officeName?: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ 
    message: string; 
    onConfirm: () => void; 
    variant?: 'danger' | 'primary';
  } | null>(null);
  const [isBreakActionLoading, setIsBreakActionLoading] = useState(false);
  const [lateStats, setLateStats] = useState({ lateCount: 0, deduction: 0.0, warningMessage: '', remainingSafeCount: 3 });
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  
  const { isOnline, pendingCount, isSyncing, syncQueue, refreshPendingCount } = useOfflineSync();

  const [sessionState, setSessionState] = useState<'ACTIVE' | 'WARNING' | 'ON_BREAK'>('ACTIVE');
  const clickCount = useRef(0);
  const keypressCount = useRef(0);
  const pointerMovesCount = useRef(0);
  const sequenceNumber = useRef(2);
  const geofenceOutsideHistory = useRef<boolean[]>([]);

  // 1. Stateful records array for real-time reconciliation updates without reload
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);

  // Disputes system states
  const [disputeRecord, setDisputeRecord] = useState<AttendanceRecord | null>(null);
  const [hijackWarning, setHijackWarning] = useState<{ active: boolean; sessionId: string } | null>(null);
  const [disputeCategory, setDisputeCategory] = useState<string>('LATE_PENALTY');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);
  const [myDisputes, setMyDisputes] = useState<EmployeeDispute[]>([]);

  // Disputes and late login stats are refreshed manually or on mount to avoid heartbeat database query storms

  const [permissionModal, setPermissionModal] = useState<{
    type: 'request' | 'blocked';
    geoState?: string;
    notifState?: string;
    onProceed?: () => void;
    onRetry?: () => void;
  } | null>(null);

  const checkAndRequestPermissions = async (onGranted: () => void) => {
    let geoState: PermissionState = 'prompt';
    let notifState = typeof window !== 'undefined' ? Notification.permission : 'default';

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const geoPerm = await navigator.permissions.query({ name: 'geolocation' });
        geoState = geoPerm.state;
      }
    } catch (e) {
      console.warn('navigator.permissions.query failed for geolocation, falling back:', e);
    }

    if (geoState === 'granted' && notifState === 'granted') {
      onGranted();
      return;
    }

    if (geoState === 'denied' || notifState === 'denied') {
      setPermissionModal({
        type: 'blocked',
        geoState,
        notifState,
        onRetry: () => {
          setPermissionModal(null);
          checkAndRequestPermissions(onGranted);
        }
      });
      return;
    }

    setPermissionModal({
      type: 'request',
      geoState,
      notifState,
      onProceed: async () => {
        setPermissionModal(null);
        let finalNotifState: NotificationPermission = notifState as NotificationPermission;
        
        if (notifState === 'default') {
          try {
            const { subscribeUserToPush } = await import('@/lib/notifications/push-helper');
            const requested = await Notification.requestPermission();
            finalNotifState = requested;
            if (requested === 'granted') {
              subscribeUserToPush().catch(console.error);
            }
          } catch (e) {
            console.error('Error requesting notification permission:', e);
          }
        }

        if (geoState === 'prompt') {
          navigator.geolocation.getCurrentPosition(
            () => {
              if (finalNotifState === 'denied') {
                setPermissionModal({
                  type: 'blocked',
                  geoState: 'granted',
                  notifState: 'denied',
                  onRetry: () => {
                    setPermissionModal(null);
                    checkAndRequestPermissions(onGranted);
                  }
                });
              } else {
                onGranted();
              }
            },
            (err) => {
              console.error('Location request error:', err);
              setPermissionModal({
                type: 'blocked',
                geoState: 'denied',
                notifState: finalNotifState,
                onRetry: () => {
                  setPermissionModal(null);
                  checkAndRequestPermissions(onGranted);
                }
              });
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          if (finalNotifState === 'granted') {
            onGranted();
          } else {
            setPermissionModal({
              type: 'blocked',
              geoState: 'granted',
              notifState: finalNotifState,
              onRetry: () => {
                setPermissionModal(null);
                checkAndRequestPermissions(onGranted);
              }
            });
          }
        }
      }
    });
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeRecord) return;
    if (!disputeReason || disputeReason.trim() === '') {
      showNotification('Please enter a reason for your dispute.', 'error');
      return;
    }

    setIsSubmittingDispute(true);
    try {
      const res = await submitDispute(disputeRecord.id, disputeCategory, disputeReason);
      if (res.success) {
        showNotification('Dispute submitted successfully.', 'success');
        setDisputeRecord(null);
        setDisputeReason('');
        // Reload disputes
        const updated = await getEmployeeDisputes();
        setMyDisputes(updated || []);
        refreshStatsAndDisputes();
      } else {
        showNotification(res.error || 'Failed to submit dispute.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('An unexpected error occurred.', 'error');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  // 2. Tab Leader Election, Suspension, Version and Escalation States
  const tabId = useRef(Math.random().toString(36).substring(7)).current;
  const [isLeader, setIsLeader] = useState(false);
  const isLeaderRef = useRef(false);
  

  const [syncBannerVisible, setSyncBannerVisible] = useState(false);
  const [heartbeatPulse, setHeartbeatPulse] = useState(false);

  const projectionVersion = useRef<number>(1);
  const gpsSuppressionUntil = useRef<number>(0);
  const LEASE_KEY = 'primetek_attendance_leader_lease_' + employeeId;
  const lastRefreshTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshStatsAndDisputes = useCallback(() => {
    getEmployeeDisputes().then((data) => {
      if (isMountedRef.current) {
        setMyDisputes(data || []);
      }
    }).catch(console.error);

    getLateLoginsStats().then((stats) => {
      if (isMountedRef.current) {
        setLateStats(stats);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    refreshStatsAndDisputes();
  }, [refreshStatsAndDisputes]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const currentShiftDate = getISTShiftDate(currentTime);
  const todayRecord = records.find(r => r.date === currentShiftDate);

  const checkedIn = !!todayRecord;
  const isCheckedOut = todayRecord && (todayRecord.status === 'Logged Out' || todayRecord.check_out);
  const checkInTime = todayRecord && todayRecord.check_in_raw ? new Date(todayRecord.check_in_raw) : null;
  const currentStatus = todayRecord ? todayRecord.status : 'Logged Out';

  const showUndoClockOut = (() => {
    if (!isCheckedOut || !todayRecord) return false;
    const productiveHours = todayRecord.productive_hours ?? 0;
    const isShiftEnded = (() => {
      if (!todayRecord.date) return false;
      const [year, month, day] = todayRecord.date.split('-').map(Number);
      const shiftEndUTC = new Date(Date.UTC(year, month - 1, day, 22, 0, 0));
      return currentTime > shiftEndUTC;
    })();
    return !isShiftEnded && productiveHours < 9;
  })();



  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lates stats are refreshed on mount and after successful mutations to avoid loop overloading

  const broadcastStateRefresh = (sessionId?: string) => {
    try {
      const bc = new BroadcastChannel('attendance_tabs');
      bc.postMessage({ type: 'STATE_REFRESH', sessionId });
      bc.close();
    } catch (err) {
      console.error('Failed to broadcast state refresh:', err);
    }
  };

  // Lightweight projection reconciliation - pulls latest DB projection state safely
  const refreshProjectionState = async (sessionId?: string, force = false) => {
    const targetSessionId = sessionId || todayRecord?.id;
    if (!targetSessionId) return;
    const now = Date.now();
    if (!force && now - lastRefreshTimeRef.current < 2000) {
      console.log('[Tab Sync]: Throttling duplicate refresh request.');
      return;
    }
    lastRefreshTimeRef.current = now;
    try {
      const res = await getAttendanceSessionState(targetSessionId);
      if (res.success && res.attendance && res.projection) {
        const att = res.attendance;
        const proj = res.projection;

        // Keep local projection version matched
        projectionVersion.current = proj.session_version;

        const checkIn = att.check_in ? new Date(att.check_in) : null;
        const checkOut = att.check_out ? new Date(att.check_out) : null;
        let durationHours = 0;
        const isValidCheckIn = checkIn && !isNaN(checkIn.getTime());
        const isValidCheckOut = checkOut && !isNaN(checkOut.getTime());

        if (isValidCheckIn && isValidCheckOut) {
          durationHours = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 10) / 10;
        }

        const newRecord: AttendanceRecord = {
          id: att.id,
          date: att.date,
          check_in_raw: att.check_in,
          check_in: isValidCheckIn ? checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null,
          check_out: isValidCheckOut ? checkOut.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null,
          duration_hours: durationHours,
          status: att.status,
          total_break_seconds: att.total_break_seconds,
          current_break_start: att.current_break_start,
          awaiting_desktop_deadline: att.awaiting_desktop_deadline,
          device_type: att.device_type,
          device_label: att.device_label,
          productive_hours: att.productive_hours,
        };

        setRecords((prev) => {
          const exists = prev.some((r) => r.id === att.id);
          if (exists) {
            return prev.map((r) => r.id === att.id ? newRecord : r);
          } else {
            return [newRecord, ...prev];
          }
        });

        // Set recovery success banner
        setSyncBannerVisible(true);
        setTimeout(() => setSyncBannerVisible(false), 5000);
      } else {
        console.warn('[Sync]: Projection reconciliation failed.');
      }
    } catch (err) {
      console.error('[Sync]: Reconciliation error:', err);
    }
  };

  // Projection Version Verification wrapper for mutations
  const executeMutationWithVersionCheck = async (
    mutationFn: () => Promise<{ success: boolean; error?: string; outOfRadius?: boolean; distance?: number; officeName?: string; recordId?: string; sessionId?: string }>,
    actionName: string
  ) => {
    if (!todayRecord) {
      // If session not created yet, just call directly
      const res = await mutationFn();
      if (res.success) {
        const sid = res.sessionId || res.recordId;
        await refreshProjectionState(sid, true);
        broadcastStateRefresh(sid);
        refreshStatsAndDisputes();
      } else {
        if (!res.outOfRadius) {
          showNotification(res.error || `Failed to ${actionName}`, 'error');
        }
      }
      return res;
    }

    try {
      const res = await getAttendanceSessionState(todayRecord.id);
      if (!res.success || !res.projection) {
        showNotification('Connection unstable. Retrying synchronization...', 'error');
        await refreshProjectionState();
        return;
      }

      const serverVersion = res.projection.session_version;
      if (serverVersion !== projectionVersion.current) {
        console.warn(`[Version Conflict]: Local version ${projectionVersion.current} vs Server version ${serverVersion}. Reconciling...`);
        showNotification('Session updated on another tab. Synchronizing status...', 'info');
        projectionVersion.current = serverVersion;
        await refreshProjectionState();
      }

      const mutationResult = await mutationFn();
      if (mutationResult.success) {
        projectionVersion.current++;
        await refreshProjectionState(todayRecord.id, true);
        // Notify other tabs to refresh projection dynamically
        broadcastStateRefresh(todayRecord.id);
        refreshStatsAndDisputes();
      } else {
        if (!mutationResult.outOfRadius) {
          showNotification(mutationResult.error || `Action failed: ${actionName}`, 'error');
        }
      }
      return mutationResult;
    } catch (err) {
      console.error(`[Mutation Error] ${actionName}:`, err);
      showNotification('Failed to connect to the server.', 'error');
    }
  };



  // 1. Lease-based Leader Election
  useEffect(() => {
    const bc = new BroadcastChannel('attendance_tabs');
    let leaseTimeoutId: NodeJS.Timeout | null = null;
    
    const checkLease = () => {
      const now = Date.now();
      const leaseRaw = localStorage.getItem(LEASE_KEY);
      let lease: { tabId: string; expiresAt: number } | null = null;
      try {
        if (leaseRaw) {
          lease = JSON.parse(leaseRaw);
        }
      } catch (e) {}

      if (!lease || now > lease.expiresAt || lease.tabId === tabId) {
        const expiresAt = now + 4000; // lease valid for 4 seconds
        localStorage.setItem(LEASE_KEY, JSON.stringify({ tabId, expiresAt }));
        
        // Double check read-after-write to guarantee exclusive leadership
        const checkAcquired = localStorage.getItem(LEASE_KEY);
        try {
          const parsed = checkAcquired ? JSON.parse(checkAcquired) : null;
          if (parsed && parsed.tabId === tabId) {
            if (!isLeaderRef.current) {
              isLeaderRef.current = true;
              setIsLeader(true);
              console.log(`[Lease Election]: Tab ${tabId} acquired leadership lease.`);
            }
          } else {
            if (isLeaderRef.current) {
              isLeaderRef.current = false;
              setIsLeader(false);
              console.log(`[Lease Election]: Tab ${tabId} lost write race for leadership.`);
            }
          }
        } catch (err) {
          if (isLeaderRef.current) {
            isLeaderRef.current = false;
            setIsLeader(false);
          }
        }
      } else {
        if (isLeaderRef.current) {
          isLeaderRef.current = false;
          setIsLeader(false);
          console.log(`[Lease Election]: Tab ${tabId} stepped down. Leader is ${lease.tabId}`);
        }
      }
    };

    bc.onmessage = (e) => {
      if (e.data.type === 'STATE_REFRESH') {
        console.log('[Tab Sync]: Received refresh request. Reconciling projection state...');
        refreshProjectionState(e.data.sessionId);
      }
    };

    const checkLeaseWithJitter = () => {
      checkLease();
      const jitter = Math.floor(Math.random() * 300);
      leaseTimeoutId = setTimeout(checkLeaseWithJitter, 1500 + jitter);
    };

    checkLease();
    leaseTimeoutId = setTimeout(checkLeaseWithJitter, 1500);

    const handleUnload = () => {
      try {
        const leaseRaw = localStorage.getItem(LEASE_KEY);
        if (leaseRaw) {
          const lease = JSON.parse(leaseRaw);
          if (lease.tabId === tabId) {
            localStorage.removeItem(LEASE_KEY); // release lease immediately
          }
        }
        bc.close();
      } catch (err) {}
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (leaseTimeoutId) clearTimeout(leaseTimeoutId);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  // Keep todayRecord ID ref updated to prevent stale closure inside timer intervals
  const todayRecordIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    todayRecordIdRef.current = todayRecord?.id;
  }, [todayRecord?.id]);

  // 2. Sleep / Suspension Tick Recovery Heuristic (30-60s threshold, lightweight sync)
  useEffect(() => {
    if (!checkedIn || isCheckedOut) return;
    let lastTime = Date.now();
    const tickInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 35000) { // 35 seconds threshold
        console.warn(`[Suspension Recovery]: Detected clock drift of ${delta}ms. Syncing projection state...`);
        const targetSessionId = todayRecordIdRef.current;
        if (targetSessionId) {
          refreshProjectionState(targetSessionId);
        }
      }
    }, 1000);
    return () => clearInterval(tickInterval);
  }, [checkedIn, isCheckedOut]);

  // 3. Visibility Change Auto-Break Listener (transition to Break (Auto) when tab is hidden)
  useEffect(() => {
    let autoBreakTimeoutId: NodeJS.Timeout | null = null;

    const handleVisibility = async () => {
      if (!isMountedRef.current) return;
      if (!isLeaderRef.current) return; // Only leader tab processes visibility/auto-break

      if (document.hidden) {
        if (checkedIn && !isCheckedOut && currentStatus === 'Working' && todayRecord) {
          console.log('[Visibility]: Tab hidden. Scheduling auto-break in 60 seconds...');
          autoBreakTimeoutId = setTimeout(async () => {
            if (isMountedRef.current && document.hidden) {
              await executeMutationWithVersionCheck(async () => {
                return await logStatusTransitionEvent(todayRecord.id, 'Break (Auto)');
              }, 'Auto Break (Page Hidden)');
            }
          }, 60000);
        }
      } else {
        if (autoBreakTimeoutId) {
          console.log('[Visibility]: Tab visible again. Cancelling scheduled auto-break.');
          clearTimeout(autoBreakTimeoutId);
          autoBreakTimeoutId = null;
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      if (autoBreakTimeoutId) clearTimeout(autoBreakTimeoutId);
    };
  }, [checkedIn, isCheckedOut, currentStatus, todayRecord]);

  // SharedWorker / BroadcastChannel Multi-Tab Idle Tracker
  useEffect(() => {
    if (typeof window === 'undefined' || !checkedIn || isCheckedOut || !todayRecord) return;
    // Only run idle tracking if currently in Working, Idle, or Break (Auto)
    if (!['Working', 'Idle', 'Break (Auto)'].includes(currentStatus)) return;

    let worker: SharedWorker | null = null;
    let fallbackBc: BroadcastChannel | null = null;
    let localInterval: any = null;

    const handleStateTransition = async (newState: 'Working' | 'Idle' | 'Break (Auto)') => {
      if (newState !== currentStatus) {
        await executeMutationWithVersionCheck(async () => {
          return await logStatusTransitionEvent(todayRecord.id, newState);
        }, `Transition to ${newState}`);
      }
    };

    try {
      worker = new SharedWorker('/workers/idle-worker.js');
      worker.port.onmessage = async (e) => {
        const { type, state: workerState } = e.data;
        if (!isLeaderRef.current) return; // Only leader tab writes status transitions to DB
        if (type === 'STATE_CHANGED') {
          await handleStateTransition(workerState);
        } else if (type === 'TRIGGER_AUTO_BREAK') {
          await handleStateTransition('Break (Auto)');
        }
      };
      worker.port.start();
    } catch (err) {
      console.warn('SharedWorker not supported or blocked, running fallback BroadcastChannel:', err);
      fallbackBc = new BroadcastChannel('idle_sync');
      fallbackBc.onmessage = async (e) => {
        const { type, state: workerState } = e.data;
        if (type === 'USER_ACTIVITY') {
          lastAct = Date.now();
          if (isLeaderRef.current && (currentStatus === 'Idle' || currentStatus === 'Break (Auto)')) {
            await handleStateTransition('Working');
            if (fallbackBc) fallbackBc.postMessage({ type: 'STATE_CHANGED', state: 'Working' });
          }
        } else if (isLeaderRef.current) {
          if (type === 'STATE_CHANGED') {
            await handleStateTransition(workerState);
          } else if (type === 'TRIGGER_AUTO_BREAK') {
            await handleStateTransition('Break (Auto)');
          }
        }
      };

      let lastAct = Date.now();
      localInterval = setInterval(async () => {
        if (!isLeaderRef.current) return; // Only leader runs the tick check
        const delta = Date.now() - lastAct;
        // 3 minutes (180,000 ms) idle threshold
        if (delta >= 180000 && delta < 300000 && currentStatus === 'Working') {
          await handleStateTransition('Idle');
          if (fallbackBc) fallbackBc.postMessage({ type: 'STATE_CHANGED', state: 'Idle' });
        } 
        // 5 minutes (300,000 ms) auto break threshold
        else if (delta >= 300000 && (currentStatus === 'Working' || currentStatus === 'Idle')) {
          clearInterval(localInterval);
          if (fallbackBc) fallbackBc.postMessage({ type: 'TRIGGER_AUTO_BREAK' });
          await handleStateTransition('Break (Auto)');
        }
      }, 1000);
      
      const onActivity = async () => {
        lastAct = Date.now();
        if (!isLeaderRef.current) {
          if (fallbackBc) fallbackBc.postMessage({ type: 'USER_ACTIVITY' });
          return;
        }
        if (currentStatus === 'Idle' || currentStatus === 'Break (Auto)') {
          await handleStateTransition('Working');
          if (fallbackBc) fallbackBc.postMessage({ type: 'STATE_CHANGED', state: 'Working' });
        }
      };
      const events = ['mousemove', 'keydown', 'click', 'scroll'];
      events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    }

    const reportActivity = () => {
      if (worker) worker.port.postMessage({ type: 'ACTIVITY' });
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, reportActivity, { passive: true }));

    return () => {
      events.forEach(ev => window.removeEventListener(ev, reportActivity));
      if (worker) worker.port.close();
      if (fallbackBc) fallbackBc.close();
      if (localInterval) clearInterval(localInterval);
    };
  }, [checkedIn, isCheckedOut, currentStatus, todayRecord]);

  // Telemetry Input Listeners
  useEffect(() => {
    if (!checkedIn || isCheckedOut || (currentStatus !== 'Working' && currentStatus !== 'Approved WFH')) return;

    const trackClick = () => { clickCount.current++; };
    const trackKeydown = () => { keypressCount.current++; };
    const trackMousemove = () => { pointerMovesCount.current++; };

    window.addEventListener('click', trackClick, { passive: true });
    window.addEventListener('keydown', trackKeydown, { passive: true });
    window.addEventListener('mousemove', trackMousemove, { passive: true });

    return () => {
      window.removeEventListener('click', trackClick);
      window.removeEventListener('keydown', trackKeydown);
      window.removeEventListener('mousemove', trackMousemove);
    };
  }, [checkedIn, isCheckedOut, currentStatus]);

  // Periodic Telemetry Heartbeat Loop
  useEffect(() => {
    const isHeartbeatActive = ['Working', 'Approved WFH', 'Break', 'Break (Auto)', 'Idle'].includes(currentStatus);
    if (!checkedIn || isCheckedOut || !isHeartbeatActive || !todayRecord) return;

    const sendHeartbeat = () => {
      if (!navigator.geolocation) return;
      if (!isLeaderRef.current) return; // Only leader sends heartbeats

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 10;
          
          const devInfo = getDeviceInfo();
          const payload = {
            sessionId: todayRecord.id,
            sequenceNumber: sequenceNumber.current,
            clientTimestamp: new Date().toISOString(),
            idempotencyKey: `hbeat-${todayRecord.id}-${sequenceNumber.current}-${Date.now()}`,
            activeWindow: !document.hidden,
            meetingMode: false,
            deviceType: devInfo.deviceType,
            deviceLabel: devInfo.deviceLabel,
            deviceFingerprint: getOrCreateFingerprint(),
            tabId: tabId,
            telemetry: {
              clicks: clickCount.current,
              keypresses: keypressCount.current,
              pointerMoves: pointerMovesCount.current,
              lat,
              lng,
              accuracy
            }
          };

          // Reset counters and increment sequence
          clickCount.current = 0;
          keypressCount.current = 0;
          pointerMovesCount.current = 0;
          sequenceNumber.current++;

          try {
            setHeartbeatPulse(true);
            setTimeout(() => {
              if (isMountedRef.current) {
                setHeartbeatPulse(false);
              }
            }, 1500);
            const res = await processHeartbeat(payload);
            if (res.success) {
              // Perform geofence verification dynamically based on heartbeat response
              const isTimerActive = currentStatus === 'Working' || currentStatus === 'DESKTOP_ACTIVE' || currentStatus === 'AWAITING_DESKTOP';
              if (isTimerActive && Date.now() >= gpsSuppressionUntil.current && res.withinRange !== undefined) {
                const outside = !res.withinRange;
                geofenceOutsideHistory.current.push(outside);
                if (geofenceOutsideHistory.current.length > 5) {
                  geofenceOutsideHistory.current.shift();
                }

                const historyLen = geofenceOutsideHistory.current.length;
                if (historyLen >= 3) {
                  const lastThree = geofenceOutsideHistory.current.slice(-3);
                  const allOutside = lastThree.every(Boolean);

                  if (allOutside) {
                    // Obsolete warning triggered but modal removed
                  }
                } else if (outside) {
                  showNotification("We're having trouble confirming your office location. Please move closer to a window or refresh your GPS signal.", 'info');
                }
              }

              if (res.status !== currentStatus) {
                // If status changed, sync local state
                await refreshProjectionState();
                const bc = new BroadcastChannel('attendance_tabs');
                bc.postMessage({ type: 'STATE_REFRESH' });
                bc.close();
              }
            } else {
              if (res.error === 'Session active on another device') {
                setHijackWarning({ active: true, sessionId: todayRecord.id });
              } else if (res.error?.includes('Session is already clocked out') || res.error?.includes('not found')) {
                showNotification("Session closed by administrator. Syncing state...", "info");
                await refreshProjectionState();
                const bc = new BroadcastChannel('attendance_tabs');
                bc.postMessage({ type: 'STATE_REFRESH' });
                bc.close();
              }
            }
          } catch (err) {
            console.error('[Heartbeat Error]:', err);
          }
        },
        (error) => {
          console.warn('[Heartbeat GPS warning]:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const isBreakOrIdle = ['Break', 'Break (Auto)', 'Idle'].includes(currentStatus);
    const heartbeatInterval = isBreakOrIdle ? 300000 : 60000;

    const interval = setInterval(sendHeartbeat, heartbeatInterval);
    return () => clearInterval(interval);
  }, [checkedIn, isCheckedOut, currentStatus, todayRecord]);

  const handleCheckIn = () => {
    checkAndRequestPermissions(async () => {
      setGpsStatus('loading');
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        
        const fingerprint = getOrCreateFingerprint();

        if (!navigator.onLine) {
          try {
            enqueueOfflineAction('check_in', lat, lng, fingerprint);
            refreshPendingCount();
            setGpsStatus('success');
            showNotification('Offline mode — check-in saved locally. It will sync when you reconnect.', 'info');
          } catch (queueErr) {
            const errorMsg = queueErr instanceof Error ? queueErr.message : 'Failed to queue offline check-in';
            setGpsStatus('error');
            showNotification(errorMsg, 'error');
          }
          return;
        }

        const devInfo = getDeviceInfo();
        const result = await executeMutationWithVersionCheck(async () => {
          const res = await checkIn(lat, lng, undefined, undefined, fingerprint, undefined, devInfo);
          return res;
        }, 'Check In');
        
        if (result && result.outOfRadius) {
          setWfhRequest({
            active: true,
            distance: result.distance,
            officeName: result.officeName
          });
          setGpsStatus('idle');
        } else if (result && result.success) {
          setGpsStatus('success');
        } else {
          setGpsStatus('error');
        }

      } catch (err) {
        if (!navigator.onLine && coords) {
          try {
            const fingerprint = getOrCreateFingerprint();
            enqueueOfflineAction('check_in', coords.lat, coords.lng, fingerprint);
            refreshPendingCount();
            setGpsStatus('success');
            showNotification('Network lost — check-in saved offline. Will sync automatically.', 'info');
            return;
          } catch { /* fall through to error */ }
        }
        const errorMsg = err instanceof Error ? err.message : 'Could not retrieve your GPS location. Please check browser permissions.';
        setGpsStatus('error');
        showNotification(errorMsg, 'error');
      }
    });
  };

  const handleWFHRequest = () => {
    checkAndRequestPermissions(async () => {
      let currentCoords = coords;
      if (!currentCoords) {
        setGpsStatus('loading');
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: true, 
              timeout: 10000 
            });
          });
          currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCoords(currentCoords);
        } catch (err) {
          setGpsStatus('error');
          showNotification('Could not retrieve your GPS location for WFH request.', 'error');
          return;
        }
      }

      setGpsStatus('loading');
      try {
        const fingerprint = getOrCreateFingerprint();
        await executeMutationWithVersionCheck(async () => {
          const result = await requestWFH(currentCoords!.lat, currentCoords!.lng, undefined, undefined, fingerprint);
          return result;
        }, 'WFH Request');
        setGpsStatus('success');
        setWfhRequest(null);
      } catch {
        setGpsStatus('error');
        showNotification('Failed to request WFH', 'error');
      }
    });
  };

  const handleCheckOut = async () => {
    const offlineQueue = getOfflineQueue();
    const pendingCheckIn = offlineQueue.find(
      e => (e.action === 'check_in' || e.action === 'wfh_request') && e.status !== 'failed'
    );

    if (!todayRecord && !pendingCheckIn) {
      showNotification('No active clock-in session found.', 'error');
      return;
    }

    setConfirmAction({
      message: 'Are you sure you want to clock out for today? Any running breaks will be ended automatically.',
      variant: 'danger',
      onConfirm: () => {
        checkAndRequestPermissions(async () => {
          setGpsStatus('loading');
          let lat: number;
          let lng: number;

          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { 
                enableHighAccuracy: true, 
                timeout: 10000 
              });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            setCoords({ lat, lng });
          } catch {
            setGpsStatus('error');
            showNotification('Could not retrieve your GPS location. Location access is required to clock out.', 'error');
            return;
          }

          const fingerprint = getOrCreateFingerprint();
          const recordId = todayRecord ? todayRecord.id : pendingCheckIn!.id;

          if (!navigator.onLine) {
            try {
              enqueueOfflineAction('check_out', lat, lng, fingerprint, recordId);
              refreshPendingCount();
              setGpsStatus('success');
              showNotification('Offline mode — check-out saved locally. It will sync when you reconnect.', 'info');
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Failed to queue offline check-out';
              setGpsStatus('error');
              showNotification(errorMsg, 'error');
            }
            return;
          }

          await executeMutationWithVersionCheck(async () => {
            const result = await checkOut(recordId, lat, lng, undefined, undefined, fingerprint);
            return result;
          }, 'Check Out');
          setGpsStatus('success');
        });
      }
    });
  };

  const handleResume = async () => {
    if (!todayRecord) return;
    setConfirmAction({
      message: 'Are you sure you want to undo your clock out and resume the current session?',
      variant: 'primary',
      onConfirm: async () => {
        setGpsStatus('loading');
        await executeMutationWithVersionCheck(async () => {
          const result = await resumeSession(todayRecord.id);
          return result;
        }, 'Resume Session');
        setGpsStatus('success');
      }
    });
  };

  const handleStartBreak = async () => {
    setIsBreakActionLoading(true);
    try {
      if (!navigator.onLine) {
        let lat = coords?.lat || 0;
        let lng = coords?.lng || 0;
        if (!coords) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
              });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            setCoords({ lat, lng });
          } catch {
            showNotification('Could not retrieve your GPS location. Location access is required to start break.', 'error');
            return;
          }
        }
        const fingerprint = getOrCreateFingerprint();
        try {
          enqueueOfflineAction('break_start', lat, lng, fingerprint);
          refreshPendingCount();
          if (todayRecord) {
            setRecords(prev => prev.map(r => r.id === todayRecord.id ? {
              ...r,
              status: 'Break',
              current_break_start: new Date().toISOString()
            } : r));
          }
          showNotification('Break start queued — will sync when online.', 'info');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to queue break start';
          showNotification(errorMsg, 'error');
        }
        return;
      }

      await executeMutationWithVersionCheck(async () => {
        const res = await startBreak();
        return res;
      }, 'Start Break');
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setIsBreakActionLoading(true);
    try {
      if (!navigator.onLine) {
        let lat = coords?.lat || 0;
        let lng = coords?.lng || 0;
        if (!coords) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
              });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            setCoords({ lat, lng });
          } catch {
            showNotification('Could not retrieve your GPS location. Location access is required to end break.', 'error');
            return;
          }
        }
        const fingerprint = getOrCreateFingerprint();
        const isBreakStartSynced = todayRecord?.status === 'Break' || todayRecord?.status === 'Break (Auto)' || !!todayRecord?.current_break_start;
        try {
          enqueueOfflineAction('break_end', lat, lng, fingerprint, undefined, isBreakStartSynced);
          refreshPendingCount();
          if (todayRecord) {
            setRecords(prev => prev.map(r => r.id === todayRecord.id ? {
              ...r,
              status: 'Working',
              total_break_seconds: (r.total_break_seconds || 0) + (r.current_break_start ? Math.max(0, Math.floor((Date.now() - new Date(r.current_break_start).getTime()) / 1000)) : 0),
              current_break_start: null
            } : r));
          }
          showNotification('Break end queued — will sync when online.', 'info');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to queue break end';
          showNotification(errorMsg, 'error');
        }
        return;
      }

      await executeMutationWithVersionCheck(async () => {
        const res = await endBreak();
        return res;
      }, 'End Break');
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  const handleResumeWork = async () => {
    if (!todayRecord) return;
    setIsBreakActionLoading(true);
    try {
      if (currentStatus === 'Idle') {
        if (!navigator.onLine) {
          setRecords(prev => prev.map(r => r.id === todayRecord.id ? {
            ...r,
            status: 'Working'
          } : r));
          showNotification('Offline mode — resumed work.', 'info');
          return;
        }
        await executeMutationWithVersionCheck(async () => {
          return await logStatusTransitionEvent(todayRecord.id, 'Working');
        }, 'Resume Work');
      } else {
        await handleEndBreak();
      }
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  // Break variables calculation
  let breakUsedSeconds = 0;
  let productiveSeconds = 0;
  let remainingBreakSeconds = 3600; // 1 hour allowed

  if (checkInTime && !isCheckedOut) {
    const totalBreakSec = todayRecord?.total_break_seconds || 0;
    const currentBreakStart = todayRecord?.current_break_start ? new Date(todayRecord.current_break_start) : null;
    
    let activeBreakSec = 0;
    if (['Break', 'Break (Auto)'].includes(currentStatus) && currentBreakStart) {
      activeBreakSec = Math.max(0, Math.floor((currentTime.getTime() - currentBreakStart.getTime()) / 1000));
    }
    
    breakUsedSeconds = totalBreakSec + activeBreakSec;
    const totalElapsedSec = Math.max(0, Math.floor((currentTime.getTime() - checkInTime.getTime()) / 1000));
    productiveSeconds = Math.max(0, totalElapsedSec - breakUsedSeconds);
    remainingBreakSeconds = Math.max(0, 3600 - breakUsedSeconds);
  }

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const elapsed = (checkInTime && !isCheckedOut) ? Math.floor((currentTime.getTime() - checkInTime.getTime()) / 1000) : 0;
  const elapsedHrs = Math.floor(elapsed / 3600);
  const elapsedMin = Math.floor((elapsed % 3600) / 60);
  const elapsedSec = elapsed % 60;

  const runningHrsDecimal = (productiveSeconds / 3600).toFixed(1);
  const displayHrs = !isCheckedOut 
    ? `${runningHrsDecimal}h / 9h` 
    : `${todayRecord?.productive_hours || 0}h / 9h`;
  const completedPercentage = !isCheckedOut
    ? Math.min(Math.round((productiveSeconds / (9 * 3600)) * 100), 100)
    : Math.min(Math.round(((todayRecord?.productive_hours || 0) / 9) * 100), 100);

  const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
  const daysInMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < monthStart.getDay(); i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Dynamic statistics calculation for the selected month
  const selectedMonthRecords = records.filter(r => {
    if (!r.date) return false;
    const dateObj = new Date(r.date);
    return dateObj.getMonth() === selectedMonthDate.getMonth() && dateObj.getFullYear() === selectedMonthDate.getFullYear();
  });

  const presentCount = selectedMonthRecords.filter(r => {
    const s = r.status?.toLowerCase();
    return s === 'present' || s === 'working' || s === 'logged out' || s === 'break' || s === 'break (auto)';
  }).length;

  const lateMonthCount = selectedMonthRecords.filter(r => r.status?.toLowerCase() === 'late').length;
  const absentCount = selectedMonthRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
  const wfhCount = selectedMonthRecords.filter(r => r.status?.toLowerCase().includes('wfh')).length;

  const getWorkingDaysCount = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dayOfWeek = new Date(year, month, d).getDay();
      if (dayOfWeek !== 0) { // Exclude Sundays
        workingDays++;
      }
    }
    return workingDays;
  };

  const workingDaysCount = getWorkingDaysCount(selectedMonthDate);
  const leaveTaken = selectedMonthRecords.filter(r => r.status?.toLowerCase().includes('leave')).length;
  const lossOfPay = selectedMonthRecords.filter(r => r.status?.toLowerCase() === 'absent').length;

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const minMonthStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  const isNextDisabled = selectedMonthDate >= currentMonthStart;
  const isPrevDisabled = selectedMonthDate <= minMonthStart;
  const isPastMonth = selectedMonthDate < currentMonthStart;

  const navigateMonth = async (direction: 'prev' | 'next') => {
    const nextDate = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + (direction === 'prev' ? -1 : 1), 1);
    if (nextDate > currentMonthStart) return;
    if (nextDate < minMonthStart) return;
    
    setIsCalendarLoading(true);
    try {
      const res = await getAttendanceForMonth(nextDate.getFullYear(), nextDate.getMonth() + 1);
      if (res && res.success && res.records) {
        setRecords(prev => {
          const merged = [...prev];
          res.records.forEach((nr: AttendanceRecord) => {
            const idx = merged.findIndex(r => r.id === nr.id);
            if (idx > -1) {
              merged[idx] = nr;
            } else {
              merged.push(nr);
            }
          });
          return merged;
        });
      }
    } catch (err) {
      console.error('Failed to fetch attendance for month:', err);
    } finally {
      setSelectedMonthDate(nextDate);
      setIsCalendarLoading(false);
    }
  };

  const getStatusForDay = (day: number) => {
    const dStr = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = records.find(r => r.date === dStr);
    return record?.status?.toLowerCase() || null;
  };

  const isHolidayForDay = (dayNum: number) => {
    if (!dayNum) return null;
    const dStr = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return holidays.find(h => h.date === dStr);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Auto-Logout Advisory Banner */}
      <AnimatePresence>
        {wasAutoLoggedOut && !checkedIn && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-800 text-sm font-sans"
          >
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium">Previous session ended automatically</p>
              <p className="text-amber-700/80 text-xs mt-0.5">
                Your previous work session was ended automatically after prolonged inactivity or connection loss. Please clock in again to continue work.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inactivity / Idle Warning Modal Overlay */}
      <AnimatePresence>
        {sessionState === 'WARNING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-lg font-bold text-navy-900 font-sans">Are you still working?</h3>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed font-sans">
                We haven't detected activity for a few minutes. Confirm you're still working to keep your session active.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between font-sans">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">Auto-Break Countdown</span>
                <span className="text-sm font-mono font-black text-amber-700">Warning Active</span>
              </div>
              <button
                onClick={() => {
                  try {
                    const sw = new SharedWorker('/workers/idle-worker.js');
                    sw.port.postMessage({ type: 'ACTIVITY' });
                    sw.port.close();
                  } catch (err) {}
                  
                  const bc = new BroadcastChannel('idle_sync');
                  bc.postMessage({ type: 'STATE_CHANGED', state: 'ACTIVE' });
                  bc.close();
                  
                  setSessionState('ACTIVE');
                }}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer font-sans"
              >
                I am still working
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Offline / Pending Sync Indicator */}
      <AnimatePresence>
        {(!isOnline || pendingCount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-semibold font-sans',
              !isOnline
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            )}
          >
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <><WifiOff className="w-4 h-4 text-amber-500" /> You are offline. Actions will save locally.</>
              ) : (
                <><RefreshCw className={cn('w-4 h-4 text-blue-500', isSyncing && 'animate-spin')} /> {pendingCount} action{pendingCount !== 1 ? 's' : ''} to sync.</>
              )}
            </div>
            {isOnline && pendingCount > 0 && (
              <button
                onClick={syncQueue}
                disabled={isSyncing}
                className="px-2.5 py-1 rounded bg-blue-600 text-white text-[9px] font-mono font-semibold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recovery / Reconnect Sync Success Banner */}
      <AnimatePresence>
        {syncBannerVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-emerald-700 text-xs font-semibold font-sans shadow-2xs bg-white"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Session synchronized successfully.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Top Warning Banner (Sentry Style) */}
      {lateStats.lateCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border text-xs font-semibold font-sans shadow-2xs bg-white",
            lateStats.lateCount >= 6 ? "border-red-200 bg-red-50/30" :
            lateStats.lateCount >= 3 ? "border-amber-200 bg-amber-50/30" : "border-primary-200 bg-primary-50/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
              lateStats.lateCount >= 6 ? "bg-red-50 text-red-600 border-red-200" :
              lateStats.lateCount >= 3 ? "bg-amber-50 text-amber-600 border-amber-200" :
              "bg-primary-50 text-primary-600 border-primary-200"
            )}>
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="font-bold text-navy-900">Late Penalty Warning:</span>
              <span className="font-medium text-zinc-600 text-xs">{lateStats.warningMessage}</span>
              <span className="hidden sm:inline text-zinc-300">|</span>
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                Lates: <span className="text-zinc-900">{lateStats.lateCount}</span> • Deductions: <span className="text-red-600">{lateStats.deduction} Day</span>
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Session Hijack Warning Modal */}
      <AnimatePresence>
        {hijackWarning?.active && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              transition={{ duration: 0.15 }}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl relative overflow-hidden font-sans space-y-4">
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                  <h3 className="text-sm font-bold text-navy-900 tracking-tight leading-tight">Session Active on Another Device</h3>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Your attendance session is currently active on another device or tab. You can move the active session to this device and browser tab to resume tracking.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setHijackWarning(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={async () => {
                      const fingerprint = getOrCreateFingerprint();
                      const res = await moveActiveSession(hijackWarning.sessionId, fingerprint, tabId);
                      if (res.success) {
                        setHijackWarning(null);
                        showNotification('Session moved to this device successfully.', 'success');
                        await refreshProjectionState();
                        const bc = new BroadcastChannel('attendance_tabs');
                        bc.postMessage({ type: 'STATE_REFRESH' });
                        bc.close();
                      } else {
                        showNotification(res.error || 'Failed to move session.', 'error');
                      }
                    }}
                    size="sm"
                    className="flex-1 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold py-2 shadow-3xs flex items-center justify-center text-center cursor-pointer"
                  >
                    Move Session Here
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px] items-stretch">
        
        {/* Left Column: Console & Controls */}
        <div className="flex flex-col gap-6">
          
          {/* Shift info header card */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs font-sans relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <CalendarIcon className="w-16 h-16 text-navy-900" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">Standard Work Hours</span>
                <h3 className="font-bold text-navy-900 text-sm tracking-tight">Shift: Night Shift</h3>
                <p className="text-xs text-zinc-500 mt-1">Your shift: 06:30 PM - 03:30 AM</p>
              </div>
              <div className="px-2.5 py-1 rounded bg-primary-50 border border-primary-200 text-primary-700 text-[9px] font-mono font-bold uppercase tracking-wider">
                Active Shift
              </div>
            </div>
          </div>

          {/* Hero Check-in Console */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-2xs flex flex-col items-center justify-between flex-1 space-y-6">
            
            {/* Subtle, sleek Raycast-style clock widget */}
            <div className="w-full bg-navy-900 text-white rounded-xl py-3 px-4 flex items-center justify-between border border-navy-900 shadow-inner">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  heartbeatPulse 
                    ? "bg-cyan-400 scale-150 shadow-[0_0_8px_#22d3ee]" 
                    : isLeader 
                      ? "bg-emerald-500 animate-pulse" 
                      : "bg-zinc-600 animate-none"
                )} />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 select-none">
                  Live System Time
                  {isLeader && (
                    <span className="text-[8px] font-mono font-semibold text-emerald-500/80 lowercase tracking-tight normal-case">
                      (active sync{heartbeatPulse && "ping..."})
                    </span>
                  )}
                </span>
              </div>
              <div className="font-mono text-sm font-black tracking-widest text-zinc-200">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>

            {/* Centered Hero Check-in / Check-out button */}
            <div className="w-full text-center space-y-3">
              {!checkedIn ? (
                <button
                  onClick={handleCheckIn}
                  data-testid="clock-in-btn"
                  disabled={gpsStatus === 'loading'}
                  style={{ backgroundColor: '#10B981' }}
                  className="w-full py-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all font-sans flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Locating GPS...</>
                  ) : (
                    <><LogIn className="w-4 h-4" /> Clock In</>
                  )}
                </button>
              ) : !isCheckedOut ? (
                <button
                  onClick={handleCheckOut}
                  disabled={gpsStatus === 'loading'}
                  style={{ backgroundColor: '#EF4444' }}
                  className="w-full py-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all font-sans flex items-center justify-center gap-2 shadow-lg shadow-red-500/10 cursor-pointer disabled:opacity-50"
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Locating GPS...</>
                  ) : (
                    <><LogOut className="w-4 h-4" /> Clock Out</>
                  )}
                </button>
              ) : (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 text-center font-sans shadow-2xs relative overflow-hidden">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Clock Out Complete</p>
                  <p className="text-[10px] text-emerald-600 mt-1 font-medium">Your attendance has been recorded successfully.</p>
                </div>
              )}

              {/* GPS status indicator badge */}
              <div className="flex items-center justify-center">
                {gpsStatus === 'loading' ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-3xs">
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin text-amber-500" /> Locating
                  </span>
                ) : coords ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-3xs">
                    GPS Verified ✓
                  </span>
                ) : gpsStatus === 'error' ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 shadow-3xs">
                    GPS Error ✗
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-zinc-50 text-zinc-500 border border-zinc-200 shadow-3xs">
                    GPS Ready
                  </span>
                )}
              </div>
            </div>

            {/* Today's Summary Card */}
            {checkedIn && (
              <div className="w-full border-t border-zinc-100 pt-5 space-y-3 font-sans">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Today's Summary</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 shadow-3xs">
                    <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1">Check-in</span>
                    <span className="font-mono text-xs font-bold text-navy-900">
                      {todayRecord?.check_in || '--:--'}
                    </span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 shadow-3xs">
                    <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1">Check-out</span>
                    <span className="font-mono text-xs font-bold text-navy-900">
                      {todayRecord?.check_out || '--:--'}
                    </span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 shadow-3xs">
                    <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1">Hours Worked</span>
                    <span className="font-mono text-xs font-bold text-navy-900">
                      {!isCheckedOut ? (
                        <span>{String(elapsedHrs).padStart(2, '0')}:{String(elapsedMin).padStart(2, '0')}</span>
                      ) : (
                        <span>{todayRecord?.duration_hours}h</span>
                      )}
                    </span>
                  </div>
                </div>
                {showUndoClockOut && (
                  <div className="text-center pt-1">
                    <button 
                      onClick={handleResume} 
                      className="text-[9px] font-mono font-semibold text-primary-700 hover:text-primary-800 uppercase tracking-wider cursor-pointer"
                    >
                      Undo Clock Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Break and Shift Monitoring Widgets */}
          {checkedIn && !isCheckedOut && (
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-2xs overflow-hidden relative flex flex-col justify-between min-h-[300px]">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-500 shadow-3xs">
                    <Coffee className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 text-sm tracking-tight font-sans">Break Control Room</h3>
                    <p className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider mt-0.5">1 hour daily permitted limit</p>
                  </div>
                </div>

                {/* Break Overrun Warning System */}
                {breakUsedSeconds >= 60 * 60 ? (
                  <motion.div
                    animate={{ scale: [1, 1.01, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center gap-2 text-xs font-semibold font-sans"
                  >
                    <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-red-500" />
                    <span>Break Limit Exceeded! Please return to work immediately.</span>
                  </motion.div>
                ) : breakUsedSeconds >= 45 * 60 ? (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-2 text-xs font-semibold font-sans">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                    <span>Approaching Allowed Break Limit (45m+ used).</span>
                  </div>
                ) : null}

                {/* Break progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-450 uppercase tracking-wider font-bold">
                    <span>Break Usage</span>
                    <span>{Math.round((breakUsedSeconds / 3600) * 100)}% ({Math.round(breakUsedSeconds / 60)}m / 60m)</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full border border-zinc-200 overflow-hidden shadow-inner">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        breakUsedSeconds >= 3600 ? "bg-red-500" :
                        breakUsedSeconds >= 2700 ? "bg-amber-500" : "bg-primary-500"
                      )}
                      style={{ width: `${Math.min((breakUsedSeconds / 3600) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Timers Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center shadow-3xs">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-1">Productive Work</span>
                    <span className="font-mono text-base font-black text-navy-900">{formatSeconds(productiveSeconds)}</span>
                  </div>
                  <div className={cn(
                    "rounded-xl p-3 border text-center shadow-3xs",
                    breakUsedSeconds >= 3600 ? "bg-red-50/50 border-red-200" : "bg-zinc-50 border-zinc-200"
                  )}>
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-1">Break Used</span>
                    <span className={cn(
                      "font-mono text-base font-black",
                      breakUsedSeconds >= 3600 ? "text-red-500" :
                      breakUsedSeconds >= 2700 ? "text-amber-600" : "text-navy-900"
                    )}>{formatSeconds(breakUsedSeconds)}</span>
                  </div>
                  <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center shadow-3xs">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-1">Remaining Allowed</span>
                    <span className="font-mono text-base font-black text-navy-900">{formatSeconds(remainingBreakSeconds)}</span>
                  </div>
                </div>
              </div>

              {/* Break Control Toggle Buttons */}
              <div className="flex gap-3 pt-5 border-t border-zinc-200 w-full">
                {['Break', 'Break (Auto)', 'Idle'].includes(currentStatus) ? (
                  <Button
                    variant="primary"
                    disabled={isBreakActionLoading}
                    onClick={handleResumeWork}
                    className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all shadow-3xs border border-emerald-500 font-sans text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                  >
                    {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Resume Work'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={(currentStatus !== 'Working' && currentStatus !== 'Approved WFH') || isBreakActionLoading}
                    onClick={handleStartBreak}
                    className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all shadow-3xs border border-zinc-200 font-sans hover:bg-zinc-50 cursor-pointer text-zinc-700"
                  >
                    {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Break'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Calendar Ledger & Stats Block */}
        <div className="flex flex-col">
          
          {/* Cal.com-Style Calendar Container */}
          <div className="bg-[#FFFFFF] rounded-[16px] pt-[20px] pb-[20px] pl-[24px] pr-[24px] border border-[#E2E8F0] shadow-xs relative flex flex-col justify-between flex-1">
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between mb-[16px]">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-[18px] h-[18px] text-[#0D9488]" />
                  <h2 className="font-bold text-[#0F172A] text-[15px] tracking-tight font-sans">Monthly Attendance Ledger</h2>
                </div>
                
                {/* Month navigation controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigateMonth('prev')}
                    disabled={isPrevDisabled || isCalendarLoading}
                    className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-500 cursor-pointer text-sm font-bold font-mono transition-colors"
                  >
                    &lt;
                  </button>
                  <div className="px-2.5 py-1 rounded bg-[#E2E8F0]/40 text-[#64748B] text-[10px] font-bold uppercase tracking-wider font-mono shadow-3xs min-w-[85px] text-center">
                    {selectedMonthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase()}
                  </div>
                  <button
                    onClick={() => navigateMonth('next')}
                    disabled={isNextDisabled || isCalendarLoading}
                    className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-500 cursor-pointer text-sm font-bold font-mono transition-colors"
                  >
                    &gt;
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0 text-center mb-[12px]">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
                  <div key={index} className="text-[12px] font-semibold text-[#64748B] py-1 uppercase tracking-wider">{d}</div>
                ))}
              </div>

              {/* Date grid area with transitions */}
              {isCalendarLoading ? (
                /* Skeleton Loader for Calendar Grid */
                <div className="grid grid-cols-7 gap-y-[8px] justify-items-center text-center animate-pulse py-[4px]">
                  {Array.from({ length: 35 }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-[4px]">
                      <div className="w-[36px] h-[36px] bg-[#E2E8F0] rounded-full" />
                      <div className="w-[5px] h-[5px] bg-[#E2E8F0] rounded-full mt-0.5" />
                    </div>
                  ))}
                </div>
              ) : selectedMonthRecords.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-[48px] text-center">
                  <CalendarIcon className="w-8 h-8 text-[#64748B] mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-[#0F172A]">
                    No attendance records for {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ) : (
                /* Calendar Grid */
                <div className="grid grid-cols-7 gap-y-[8px] justify-items-center text-center">
                  {calendarDays.map((day, i) => {
                    const status = day ? getStatusForDay(day) : null;
                    const isToday = day === new Date().getDate() && selectedMonthDate.getMonth() === new Date().getMonth() && selectedMonthDate.getFullYear() === new Date().getFullYear();
                    const holiday = day ? isHolidayForDay(day) : null;

                    const getStatusDotColor = (s: string | null, dayNum: number) => {
                      if (s) {
                        const statusLower = s.toLowerCase();
                        if (statusLower === 'present' || statusLower === 'working' || statusLower === 'logged out' || statusLower === 'break' || statusLower === 'break (auto)' || statusLower === 'desktop_active' || statusLower === 'desktop active') return 'bg-[#10B981]';
                        if (statusLower === 'late') return 'bg-[#F59E0B]';
                        if (statusLower === 'absent' || statusLower === 'rejected wfh' || statusLower === 'productive_timer_paused' || statusLower === 'productive timer paused' || statusLower === 'timer paused') return 'bg-[#EF4444]';
                        if (statusLower.includes('wfh') || statusLower === 'half-day' || statusLower === 'awaiting_desktop' || statusLower === 'awaiting desktop' || statusLower === 'mobile_clocked_in' || statusLower === 'mobile clocked in') return 'bg-[#3B82F6]';
                        if (statusLower === 'holiday' || statusLower === 'off' || statusLower === 'weekly off') return 'bg-[#CBD5E1]';
                      }
                      if (holiday) {
                        return 'bg-primary-600';
                      }
                      const dateObj = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), dayNum);
                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                      if (isWeekend) {
                        return 'bg-[#CBD5E1]';
                      }
                      return null;
                    };

                    const dotColor = day ? getStatusDotColor(status, day) : null;

                    return (
                      <div key={i} className="flex flex-col items-center justify-center relative select-none">
                        {day ? (
                          <div className="flex flex-col items-center gap-[4px] relative">
                            <div
                              className={cn(
                                "w-[36px] h-[36px] rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-default",
                                isToday 
                                  ? "bg-[#0F172A] text-white font-bold" 
                                  : holiday
                                    ? "bg-primary-50/60 text-primary-600 hover:bg-primary-50 font-bold"
                                    : "text-[#0F172A] hover:bg-[#F8FAFC]"
                              )}
                            >
                              <span>{day}</span>
                            </div>
                            {/* Dot below date number */}
                            <div className="h-[5px] flex items-center justify-center">
                              {dotColor ? (
                                <span className={cn("w-[5px] h-[5px] rounded-full", dotColor)} />
                              ) : (
                                <span className="w-[5px] h-[5px] rounded-full bg-transparent" />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-[36px] h-[36px]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-[#E2E8F0] my-[16px]" />

            {/* Stats row or skeleton */}
            {isCalendarLoading ? (
              <div className="grid grid-cols-4 gap-2 text-center w-full animate-pulse">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-[20px] bg-[#E2E8F0] rounded" />
                    <div className="w-12 h-[11px] bg-[#E2E8F0] rounded mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-0 text-center w-full">
                <div className="text-center flex flex-col items-center">
                  <span className="text-[20px] font-bold block text-[#10B981] leading-none">{presentCount}</span>
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em] mt-1.5">Present</span>
                </div>
                <div className="text-center flex flex-col items-center">
                  <span className="text-[20px] font-bold block text-[#F59E0B] leading-none">{lateMonthCount}</span>
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em] mt-1.5">Late</span>
                </div>
                <div className="text-center flex flex-col items-center">
                  <span className="text-[20px] font-bold block text-[#EF4444] leading-none">{absentCount}</span>
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em] mt-1.5">Absent</span>
                </div>
                <div className="text-center flex flex-col items-center">
                  <span className="text-[20px] font-bold block text-[#3B82F6] leading-none">{wfhCount}</span>
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em] mt-1.5">WFH</span>
                </div>
              </div>
            )}
          </div>

          {/* Office Holidays Card */}
          {!isCalendarLoading && (
            <div className="bg-[#FFFFFF] rounded-[12px] p-[16px] border border-[#E2E8F0] shadow-xs mt-[16px] font-sans">
              <div className="flex items-center gap-2 mb-3">
                <CalendarIcon className="w-4 h-4 text-primary-600" />
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.05em]">
                  Office Holidays in {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              {(() => {
                const currentMonthHolidays = holidays.filter(h => {
                  const hDate = new Date(h.date);
                  return hDate.getMonth() === selectedMonthDate.getMonth() && hDate.getFullYear() === selectedMonthDate.getFullYear();
                });
                if (currentMonthHolidays.length === 0) {
                  return <p className="text-xs text-zinc-450 italic">No holidays scheduled for this month.</p>;
                }
                return (
                  <div className="space-y-2">
                    {currentMonthHolidays.map((holiday) => {
                      const hDate = new Date(holiday.date);
                      const formattedDate = hDate.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        weekday: 'short'
                      });
                      return (
                        <div key={holiday.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-[#E6F8F2]/40 border border-[#E6F8F2]/60 text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#071B3A]">{holiday.title}</span>
                            <span className="text-[10px] text-primary-600 font-semibold">{holiday.type}</span>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-[#64748B]">{formattedDate}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Month Summary Card (shown only for past months below stats) */}
          {isPastMonth && !isCalendarLoading && (
            <div className="bg-[#FFFFFF] rounded-[12px] p-[16px] border border-[#E2E8F0] shadow-xs mt-[16px] font-sans">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.05em] block mb-3">
                Month Summary: {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]/50">
                  <span className="text-[#64748B] font-medium">Working Days:</span>
                  <span className="font-semibold text-[#0F172A]">{workingDaysCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]/50">
                  <span className="text-[#64748B] font-medium">Days Present:</span>
                  <span className="font-semibold text-[#0F172A]">{presentCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]/50 md:border-none">
                  <span className="text-[#64748B] font-medium">Leave Taken:</span>
                  <span className="font-semibold text-[#0F172A]">{leaveTaken}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]/50 md:border-none">
                  <span className="text-[#64748B] font-medium">Loss of Pay:</span>
                  <span className="font-semibold text-[#EF4444]">{lossOfPay}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Sequence */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-5 bg-primary-500 rounded-full" />
          <h2 className="font-semibold text-navy-900 text-sm tracking-tight font-sans">Attendance History</h2>
        </div>

        {/* Mobile: Card List Layout */}
        <div className="block md:hidden space-y-2">
          {initialRecords.map(r => (
            <div key={r.id} className="p-4 rounded-xl border border-zinc-200 bg-white shadow-2xs font-sans">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-navy-900 tracking-tight text-xs">
                  {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                  <Clock className="w-3 h-3 text-zinc-450" />
                  <span>{r.check_in || '--:--'} → {r.check_out || 'Active'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1 bg-zinc-100 rounded-full overflow-hidden border border-zinc-150">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(((r.productive_hours || 0) / 9) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-navy-900 font-mono">{r.productive_hours || 0}h</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-100">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                  {myDisputes.some(d => d.attendance_id === r.id) ? (
                    <span className={cn(
                      myDisputes.find(d => d.attendance_id === r.id)?.status === 'APPROVED' ? "text-emerald-600" :
                      myDisputes.find(d => d.attendance_id === r.id)?.status === 'REJECTED' ? "text-red-655" : "text-amber-600"
                    )}>
                      Correction: {myDisputes.find(d => d.attendance_id === r.id)?.status}
                    </span>
                  ) : (
                    <span className="text-zinc-400">No corrections requested</span>
                  )}
                </span>
                {!myDisputes.some(d => d.attendance_id === r.id) && (
                  <button
                    onClick={() => {
                      setDisputeRecord(r);
                      setDisputeReason('');
                    }}
                    className="px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[9px] font-bold text-navy-900 hover:bg-zinc-100 transition-colors uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Request Correction
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Full Table Layout */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white hidden md:block shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Work Hours</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-sans">
                {initialRecords.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/40 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy-900 tracking-tight text-xs">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{r.check_in || '--:--'} → {r.check_out || 'Clocked In'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-zinc-100 rounded-full overflow-hidden border border-zinc-150">
                          <div 
                            className="h-full bg-primary-500 rounded-full" 
                            style={{ width: `${Math.min(((r.productive_hours || 0) / 9) * 100, 100)}%` }} 
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-navy-900 font-mono">{r.productive_hours || 0}h</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {myDisputes.some(d => d.attendance_id === r.id) ? (
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-mono",
                            myDisputes.find(d => d.attendance_id === r.id)?.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            myDisputes.find(d => d.attendance_id === r.id)?.status === 'REJECTED' ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            Correction: {myDisputes.find(d => d.attendance_id === r.id)?.status}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setDisputeRecord(r);
                              setDisputeReason('');
                            }}
                            className="px-2 py-1 bg-zinc-55 hover:bg-zinc-100 border border-zinc-200 rounded text-[10px] font-bold text-navy-900 transition-colors uppercase tracking-wider font-mono cursor-pointer"
                          >
                            Request Correction
                          </button>
                        )}
                        <History className="w-3.5 h-3.5 text-zinc-300 group-hover:text-primary-500 transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* WFH Request Interface */}
      <AnimatePresence>
        {wfhRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              transition={{ duration: 0.15 }}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl relative overflow-hidden font-sans">
                <div className="absolute top-0 right-0 p-4">
                  <button 
                    onClick={() => setWfhRequest(null)}
                    className="w-8 h-8 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-650 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl border border-primary-200 bg-primary-50 text-primary-500 flex items-center justify-center shadow-3xs mb-1">
                    <Home className="w-6 h-6" />
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight leading-tight">Work from Home Request?</h3>
                    <div className="mt-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 font-medium leading-relaxed">
                      You are currently <span className="font-bold text-navy-900 text-xs">{formatDistance(wfhRequest.distance || 0)}</span> away from the office (<span className="font-bold text-navy-900">{wfhRequest.officeName}</span>).
                      <p className="mt-1.5 italic">You are outside the office range. Would you like to submit a Work From Home (WFH) check-in request instead?</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col w-full gap-2 pt-4">
                    <Button 
                      onClick={handleWFHRequest} 
                      disabled={gpsStatus === 'loading'} 
                      size="sm"
                      className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-semibold"
                    >
                      Submit WFH Check-In
                    </Button>
                    <button 
                      onClick={() => setWfhRequest(null)} 
                      className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider hover:text-navy-900 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div 
            onClick={() => setConfirmAction(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm cursor-default"
            >
              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xl relative overflow-hidden font-sans">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl border flex items-center justify-center",
                    confirmAction.variant === 'danger' ? "bg-red-50 border-red-200 text-red-500" : "bg-primary-50 border-primary-200 text-primary-500"
                  )}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight">Confirm Action</h3>
                    <p className="text-xs text-zinc-450 mt-1.5 font-medium leading-relaxed">{confirmAction.message}</p>
                  </div>
                  <div className="flex w-full gap-2 pt-2">
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 py-2 px-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition-all cursor-pointer border border-zinc-200"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={() => {
                        confirmAction.onConfirm();
                        setConfirmAction(null);
                      }}
                      size="sm"
                      className={cn(
                        "flex-1 border rounded-xl py-2 text-xs font-semibold shadow-3xs",
                        confirmAction.variant === 'danger' 
                          ? "bg-red-500 hover:bg-red-650 border-red-500 text-white" 
                          : "bg-navy-900 hover:bg-navy-800 border-navy-950 text-white"
                      )}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Dispute Modal */}
      <AnimatePresence>
        {disputeRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              transition={{ duration: 0.15 }}
              className="w-full max-w-md"
            >
              <form onSubmit={handleDisputeSubmit} className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl relative overflow-hidden font-sans space-y-4">
                <div className="absolute top-0 right-0 p-4">
                  <button 
                    type="button"
                    onClick={() => setDisputeRecord(null)}
                    disabled={isSubmittingDispute}
                    className="w-8 h-8 rounded-xl border border-zinc-200 bg-zinc-55 hover:bg-zinc-100 flex items-center justify-center text-zinc-650 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-amber-200 bg-amber-50 text-amber-500 flex items-center justify-center shadow-3xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight">Request Attendance Correction</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                      Session Date: {new Date(disputeRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">
                      Correction Category
                    </label>
                    <select
                      value={disputeCategory}
                      onChange={(e) => setDisputeCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer bg-white"
                    >
                      <option value="LATE_PENALTY">Late Login Penalty Exemption</option>
                      <option value="GPS_AUTO_BREAK">GPS Auto-Break Adjustment</option>
                      <option value="IDLE_WARNING">Idle Hours Warning Exemption</option>
                      <option value="MISSING_TIME">Missing Time / Heartbeat Sync Correction</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">
                      Correction Reason / Explanation (Mandatory)
                    </label>
                    <textarea
                      placeholder="Provide detailed context, client meeting explanation, or network error details..."
                      required
                      rows={4}
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-zinc-350"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisputeRecord(null)}
                    disabled={isSubmittingDispute}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    disabled={isSubmittingDispute}
                    size="sm"
                    className="flex-1 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold py-2 shadow-3xs flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingDispute ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Dispute'
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-full max-w-sm px-4"
          >
            <div className={cn(
              "rounded-xl p-4 shadow-xl border backdrop-blur-md flex items-start gap-3 bg-white/95 border-zinc-200 font-sans",
              notification.type === 'success' ? "text-emerald-700" :
              notification.type === 'error' ? "text-red-700" :
              "text-primary-700"
            )}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              ) : (
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-primary-500" />
              )}
              <div className="flex-1">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-navy-900">
                  {notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Notification'}
                </p>
                <p className="text-[11px] mt-1 text-zinc-450 font-medium leading-relaxed">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Permission Modal */}
      <AnimatePresence>
        {permissionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans text-navy-900"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3 text-primary-600">
                <Bell className="w-8 h-8 text-primary-500" />
                <h3 className="text-lg font-bold text-navy-900 font-sans">
                  {permissionModal.type === 'request' ? 'Permissions Required' : 'Permissions Blocked'}
                </h3>
              </div>
              
              {permissionModal.type === 'request' ? (
                <>
                  <p className="text-xs text-zinc-650 leading-relaxed font-sans">
                    Primetek Portal requires the following permissions to enable check-in/out functionality:
                  </p>
                  <ul className="space-y-2.5 text-xs text-zinc-600 font-sans">
                    {permissionModal.geoState === 'prompt' && (
                      <li className="flex items-start gap-2.5 bg-zinc-50 border border-zinc-150 p-3 rounded-xl">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-navy-900">Location Access</strong>
                          Required to verify that your clock-in/out occurs within the office geofence.
                        </div>
                      </li>
                    )}
                    {permissionModal.notifState === 'default' && (
                      <li className="flex items-start gap-2.5 bg-zinc-50 border border-zinc-150 p-3 rounded-xl">
                        <Bell className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-navy-900">Notifications</strong>
                          Used to send alerts regarding leave approvals, auto-breaks, and shift reminders.
                        </div>
                      </li>
                    )}
                  </ul>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPermissionModal(null)}
                      className="flex-1 py-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold uppercase tracking-wider transition-colors border border-zinc-200 cursor-pointer font-sans"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={permissionModal.onProceed}
                      className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer font-sans border-0"
                    >
                      Grant Permissions
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-650 leading-relaxed font-sans">
                    One or more required permissions are blocked in your browser or device settings. Please reset them to continue:
                  </p>
                  <ul className="space-y-2.5 text-xs text-zinc-600 font-sans">
                    {permissionModal.geoState === 'denied' && (
                      <li className="flex items-start gap-2.5 bg-red-50/50 border border-red-200/40 p-3 rounded-xl">
                        <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-red-700">Location Blocked</strong>
                          Click on the settings/lock icon in your browser address bar and change Location permission to <strong>Allow</strong>.
                        </div>
                      </li>
                    )}
                    {permissionModal.notifState === 'denied' && (
                      <li className="flex items-start gap-2.5 bg-red-50/50 border border-red-200/40 p-3 rounded-xl">
                        <Bell className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-red-700">Notifications Blocked</strong>
                          Go to your browser settings or PWA settings and enable Notifications for this site.
                        </div>
                      </li>
                    )}
                  </ul>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPermissionModal(null)}
                      className="flex-1 py-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold uppercase tracking-wider transition-colors border border-zinc-200 cursor-pointer font-sans"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={permissionModal.onRetry}
                      className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer font-sans border-0"
                    >
                      I Enabled Them - Retry
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
