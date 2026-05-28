'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, LogIn, LogOut, Loader2, Home, AlertCircle, X, Sparkles, History, Calendar as CalendarIcon, Clock, Info, WifiOff, RefreshCw, AlertTriangle, Coffee, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDistance, getISTShiftDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { checkIn, checkOut, resumeSession, requestWFH, startBreak, endBreak, getLateLoginsStats, checkGeofence, processHeartbeat, getAttendanceSessionState, logGPSDismissEvent, submitDispute, getEmployeeDisputes } from './actions';
import { getOrCreateFingerprint } from '@/lib/security/client-fingerprint';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { enqueueOfflineAction, getOfflineQueue } from '@/lib/offline-queue';
import { getDeviceInfo } from '@/lib/security/device-detect';

const statusColors: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  'half-day': 'bg-blue-50 text-blue-700 border-blue-200',
  'pending wfh': 'bg-violet-50 text-violet-700 border-violet-200',
  'approved wfh': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'rejected wfh': 'bg-red-50 text-red-700 border-red-200',
  working: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'on break': 'bg-primary-50 text-primary-700 border-primary-200 animate-pulse',
  'logged out': 'bg-zinc-50 text-zinc-600 border-zinc-200',
  mobile_clocked_in: 'bg-violet-50 text-violet-700 border-violet-200',
  awaiting_desktop: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  desktop_active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  productive_timer_paused: 'bg-red-50 text-red-700 border-red-200',
};

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
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const getTheme = () => {
    if (['approved', 'logged out', 'approved wfh', 'desktop_active', 'desktop active'].includes(s)) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    }
    if (['pending', 'pending wfh', 'working', 'awaiting_desktop', 'awaiting desktop', 'mobile_clocked_in', 'mobile clocked in'].includes(s)) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    if (['rejected', 'rejected wfh', 'absent', 'productive_timer_paused', 'productive timer paused', 'timer paused'].includes(s)) {
      return { bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
    }
    if (s === 'on break') {
      return { bg: 'bg-primary-50 text-primary-700 border-primary-200', dot: 'bg-primary-500' };
    }
    return { bg: 'bg-zinc-50 text-zinc-700 border-zinc-200', dot: 'bg-zinc-400' };
  };

  const theme = getTheme();

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium border uppercase tracking-wider',
      theme.bg
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', theme.dot)} />
      {status}
    </span>
  );
}

export default function AttendanceClient({ initialRecords }: { initialRecords: AttendanceRecord[] }) {
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
  const geofenceHistory = useRef<{ lat: number; lng: number; accuracy: number }[]>([]);

  // 1. Stateful records array for real-time reconciliation updates without reload
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);

  // Disputes system states
  const [disputeRecord, setDisputeRecord] = useState<AttendanceRecord | null>(null);
  const [disputeCategory, setDisputeCategory] = useState<string>('LATE_PENALTY');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);
  const [myDisputes, setMyDisputes] = useState<any[]>([]);

  useEffect(() => {
    getEmployeeDisputes().then((data) => {
      setMyDisputes(data || []);
    }).catch(console.error);
  }, [records]);

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
  
  const [gpsWarningSeconds, setGpsWarningSeconds] = useState<number | null>(null);
  const [gpsConfidence, setGpsConfidence] = useState<number>(100); // 100 -> 60 (suspicious) -> 30 (critical retry) -> 0 (auto-break)
  const [gpsWarningSuspended, setGpsWarningSuspended] = useState(false);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [syncBannerVisible, setSyncBannerVisible] = useState(false);

  const projectionVersion = useRef<number>(1);
  const gpsSuppressionUntil = useRef<number>(0);
  const LEASE_KEY = 'primetek_attendance_leader_lease';

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

  const verificationAttempted = useRef(false);
  const [countdownText, setCountdownText] = useState('10:00');

  const triggerDesktopVerification = async () => {
    if (!todayRecord || !navigator.geolocation) return;
    
    showNotification('Detecting workstation location...', 'info');
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
          idempotencyKey: `hbeat-verify-${todayRecord.id}-${sequenceNumber.current}-${Date.now()}`,
          activeWindow: !document.hidden,
          meetingMode: false,
          deviceType: devInfo.deviceType,
          deviceLabel: devInfo.deviceLabel,
          telemetry: {
            clicks: 0,
            keypresses: 0,
            pointerMoves: 0,
            lat,
            lng,
            accuracy
          }
        };
        
        sequenceNumber.current++;
        
        try {
          const res = await processHeartbeat(payload);
          if (res.success) {
            if (res.status === 'DESKTOP_ACTIVE') {
              showNotification('Desktop work session verified successfully.', 'success');
            } else {
              showNotification('Verification processed. Status: ' + res.status, 'info');
            }
            await refreshProjectionState();
            
            // Broadcast state refresh to other tabs
            const bc = new BroadcastChannel('attendance_tabs');
            bc.postMessage({ type: 'STATE_REFRESH' });
            bc.close();
          } else {
            showNotification(res.error || 'Desktop verification failed.', 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Verification network error.', 'error');
        }
      },
      (error) => {
        showNotification('GPS access required for desktop verification: ' + error.message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Instant desktop verification trigger when page loads or status updates
  useEffect(() => {
    if (checkedIn && !isCheckedOut && (currentStatus === 'AWAITING_DESKTOP' || currentStatus === 'PRODUCTIVE_TIMER_PAUSED')) {
      const devInfo = getDeviceInfo();
      if (devInfo.deviceType === 'desktop' && !verificationAttempted.current) {
        verificationAttempted.current = true;
        triggerDesktopVerification();
      }
    } else {
      verificationAttempted.current = false;
    }
  }, [checkedIn, currentStatus]);

  // Countdown timer hook for Awaiting Desktop state
  useEffect(() => {
    if (currentStatus !== 'AWAITING_DESKTOP' || !todayRecord?.awaiting_desktop_deadline) return;
    const target = new Date(todayRecord.awaiting_desktop_deadline).getTime();
    
    const interval = setInterval(() => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdownText('00:00');
        clearInterval(interval);
        refreshProjectionState();
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdownText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentStatus, todayRecord?.awaiting_desktop_deadline]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    getLateLoginsStats().then((stats) => {
      if (active) {
        setLateStats(stats);
      }
    }).catch(console.error);
    return () => {
      active = false;
    };
  }, [records]);

  const broadcastStateRefreshAndReload = () => {
    try {
      const bc = new BroadcastChannel('attendance_tabs');
      bc.postMessage({ type: 'STATE_REFRESH' });
      bc.close();
    } catch (err) {
      console.error('Failed to broadcast state refresh:', err);
    }
    window.location.reload();
  };

  // Lightweight projection reconciliation - pulls latest DB projection state safely
  const refreshProjectionState = async () => {
    if (!todayRecord) return;
    try {
      const res = await getAttendanceSessionState(todayRecord.id);
      if (res.success && res.attendance && res.projection) {
        const att = res.attendance;
        const proj = res.projection;

        // Keep local projection version matched
        projectionVersion.current = proj.session_version;

        setRecords((prev) => {
          return prev.map((r) => {
            if (r.id === att.id) {
              const checkIn = att.check_in ? new Date(att.check_in) : null;
              const checkOut = att.check_out ? new Date(att.check_out) : null;
              let durationHours = 0;
              const isValidCheckIn = checkIn && !isNaN(checkIn.getTime());
              const isValidCheckOut = checkOut && !isNaN(checkOut.getTime());

              if (isValidCheckIn && isValidCheckOut) {
                durationHours = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 10) / 10;
              }
              return {
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
              };
            }
            return r;
          });
        });

        // Set recovery success banner
        setSyncBannerVisible(true);
        setTimeout(() => setSyncBannerVisible(false), 5000);
      } else {
        console.warn('[Sync]: Projection reconciliation failed, forcing reload...');
        window.location.reload();
      }
    } catch (err) {
      console.error('[Sync]: Reconciliation error, forcing reload:', err);
      window.location.reload();
    }
  };

  // Projection Version Verification wrapper for mutations
  const executeMutationWithVersionCheck = async (
    mutationFn: () => Promise<{ success: boolean; error?: string }>,
    actionName: string
  ) => {
    if (!todayRecord) {
      // If session not created yet, just call directly
      const res = await mutationFn();
      if (res.success) {
        broadcastStateRefreshAndReload();
      } else {
        showNotification(res.error || `Failed to ${actionName}`, 'error');
      }
      return;
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
        await refreshProjectionState();
        return;
      }

      const mutationResult = await mutationFn();
      if (mutationResult.success) {
        projectionVersion.current++;
        await refreshProjectionState();
        // Notify other tabs to refresh projection dynamically
        const bc = new BroadcastChannel('attendance_tabs');
        bc.postMessage({ type: 'STATE_REFRESH' });
        bc.close();
      } else {
        showNotification(mutationResult.error || `Action failed: ${actionName}`, 'error');
      }
    } catch (err) {
      console.error(`[Mutation Error] ${actionName}:`, err);
      showNotification('Failed to connect to the server.', 'error');
    }
  };

  const handleVerifyLocation = async () => {
    setIsVerifyingLocation(true);
    if (!navigator.geolocation) {
      setIsVerifyingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const checkRes = await checkGeofence(lat, lng);
          if (checkRes.success && checkRes.withinRange) {
            setGpsWarningSeconds(null);
            setGpsConfidence(100);
            geofenceHistory.current = [];
            showNotification('Location verified successfully. Active status restored.', 'success');
          } else {
            showNotification('Verification failed. Still outside range.', 'error');
          }
        } catch (err) {
          showNotification('Error checking geofence coordinates.', 'error');
        } finally {
          setIsVerifyingLocation(false);
        }
      },
      (error) => {
        showNotification('Could not access geolocation. Please check permissions.', 'error');
        setIsVerifyingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleDismissGpsWarning = async () => {
    if (!todayRecord) return;
    let lat = 0;
    let lng = 0;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          logGPSDismissEvent(todayRecord.id, lat, lng);
        },
        () => {
          logGPSDismissEvent(todayRecord.id, lat, lng);
        }
      );
    } else {
      await logGPSDismissEvent(todayRecord.id, lat, lng);
    }
    gpsSuppressionUntil.current = Date.now() + 5 * 60 * 1000;
    setGpsWarningSeconds(null);
    setGpsConfidence(100);
    showNotification('GPS warning dismissed for 5 minutes.', 'info');
  };

  // 1. Lease-based Leader Election
  useEffect(() => {
    const bc = new BroadcastChannel('attendance_tabs');
    
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
        if (!isLeaderRef.current) {
          isLeaderRef.current = true;
          setIsLeader(true);
          console.log(`[Lease Election]: Tab ${tabId} acquired leadership lease.`);
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
        refreshProjectionState();
      }
    };

    checkLease();
    const leaseInterval = setInterval(checkLease, 1500);

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
      clearInterval(leaseInterval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

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
        refreshProjectionState();
      }
    }, 1000);
    return () => clearInterval(tickInterval);
  }, [checkedIn, isCheckedOut]);

  // 3. Countdown Pause Listener
  useEffect(() => {
    const handleVisibility = () => {
      setGpsWarningSuspended(document.hidden || !navigator.onLine);
    };
    const handleOnlineStatus = () => {
      setGpsWarningSuspended(document.hidden || !navigator.onLine);
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // 4. GPS Warning Countdown & Escalation Logic
  useEffect(() => {
    if (gpsWarningSeconds === null) return;
    if (gpsWarningSeconds <= 0) {
      if (gpsConfidence === 60) {
        // Suspicious -> degrade confidence to 30, retry window of 30 seconds
        setGpsConfidence(30);
        setGpsWarningSeconds(30);
        showNotification('GPS signal weak. Initiating second location verification window...', 'info');
      } else if (gpsConfidence === 30) {
        // Critical countdown expired -> degrade to 0 and trigger auto break
        setGpsConfidence(0);
        const triggerAutoBreak = async () => {
          showNotification('Location verification timed out. Pausing session...', 'error');
          const breakRes = await startBreak();
          if (breakRes.success) {
            showNotification("Your timer was paused due to inactivity. Click 'Resume Work' when you are back at your desk.", 'info');
            refreshProjectionState();
            const bc = new BroadcastChannel('attendance_tabs');
            bc.postMessage({ type: 'STATE_REFRESH' });
            bc.close();
          }
        };
        triggerAutoBreak();
      }
      return;
    }

    // Pause countdown when warning is suspended
    if (gpsWarningSuspended || document.hidden || !navigator.onLine) {
      return;
    }

    const interval = setInterval(() => {
      setGpsWarningSeconds((prev) => {
        if (prev === null || prev <= 0) return null;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gpsWarningSeconds, gpsConfidence, gpsWarningSuspended]);

  // SharedWorker / BroadcastChannel Multi-Tab Idle Tracker
  useEffect(() => {
    if (typeof window === 'undefined' || !checkedIn || isCheckedOut || currentStatus !== 'Working') return;

    let worker: SharedWorker | null = null;
    let fallbackBc: BroadcastChannel | null = null;
    let localInterval: any = null;

    try {
      worker = new SharedWorker('/workers/idle-worker.js');
      worker.port.onmessage = (e) => {
        const { type, state } = e.data;
        if (type === 'STATE_CHANGED') {
          setSessionState(state);
        } else if (type === 'TRIGGER_AUTO_BREAK') {
          showNotification("Your timer was paused due to inactivity. Click 'Resume Work' when you are back at your desk.", 'info');
          handleStartBreak();
        }
      };
      worker.port.start();
    } catch (err) {
      console.warn('SharedWorker not supported or blocked, running fallback BroadcastChannel:', err);
      fallbackBc = new BroadcastChannel('idle_sync');
      fallbackBc.onmessage = (e) => {
        const { type, state } = e.data;
        if (type === 'STATE_CHANGED') {
          setSessionState(state);
        } else if (type === 'TRIGGER_AUTO_BREAK') {
          showNotification("Your timer was paused due to inactivity. Click 'Resume Work' when you are back at your desk.", 'info');
          handleStartBreak();
        }
      };

      let lastAct = Date.now();
      localInterval = setInterval(() => {
        const delta = Date.now() - lastAct;
        if (delta >= 300000 && sessionState === 'ACTIVE') {
          setSessionState('WARNING');
          if (fallbackBc) fallbackBc.postMessage({ type: 'STATE_CHANGED', state: 'WARNING' });
        } else if (delta >= 360000 && sessionState === 'WARNING') {
          clearInterval(localInterval);
          if (fallbackBc) fallbackBc.postMessage({ type: 'TRIGGER_AUTO_BREAK' });
          handleStartBreak();
        }
      }, 1000);
      
      const onActivity = () => {
        lastAct = Date.now();
        if (sessionState !== 'ACTIVE') {
          setSessionState('ACTIVE');
          if (fallbackBc) fallbackBc.postMessage({ type: 'STATE_CHANGED', state: 'ACTIVE' });
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
  }, [checkedIn, isCheckedOut, currentStatus, sessionState]);

  // Telemetry Input Listeners
  useEffect(() => {
    if (!checkedIn || isCheckedOut || currentStatus !== 'Working') return;

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
    const isTimerActive = currentStatus === 'Working' || currentStatus === 'DESKTOP_ACTIVE' || currentStatus === 'AWAITING_DESKTOP' || currentStatus === 'PRODUCTIVE_TIMER_PAUSED';
    if (!checkedIn || isCheckedOut || !isTimerActive || !todayRecord) return;

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
            const res = await processHeartbeat(payload);
            if (res.success) {
              if (res.status === 'On Break') {
                showNotification("Your timer was paused due to inactivity. Click 'Resume Work' when you are back at your desk.", 'info');
                setTimeout(() => {
                  refreshProjectionState();
                  const bc = new BroadcastChannel('attendance_tabs');
                  bc.postMessage({ type: 'STATE_REFRESH' });
                  bc.close();
                }, 1500);
              } else if (res.status !== currentStatus) {
                // If status changed (e.g. verified desktop or expired), sync local state
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

    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [checkedIn, isCheckedOut, currentStatus, todayRecord]);

  // Sliding Window Geofence Checker
  useEffect(() => {
    const isTimerActive = currentStatus === 'Working' || currentStatus === 'DESKTOP_ACTIVE' || currentStatus === 'AWAITING_DESKTOP';
    if (!checkedIn || isCheckedOut || !isTimerActive) return;

    const performGeofenceCheck = () => {
      if (Date.now() < gpsSuppressionUntil.current) {
        return; // Geofence check suppressed for dismiss duration
      }
      if (!navigator.geolocation) return;
      if (!isLeaderRef.current) return; // Only leader checks geofence

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 10;
          
          geofenceHistory.current.push({ lat, lng, accuracy });
          if (geofenceHistory.current.length > 5) {
            geofenceHistory.current.shift();
          }

          try {
            const currentRes = await checkGeofence(lat, lng);
            
            if (geofenceHistory.current.length >= 3) {
              const results = await Promise.all(
                geofenceHistory.current.map(async (check) => {
                  const checkRes = await checkGeofence(check.lat, check.lng);
                  return checkRes.success && !checkRes.withinRange;
                })
              );
              const outsideCount = results.filter(Boolean).length;

              if (outsideCount >= 3) {
                setGpsConfidence((prev) => {
                  if (prev === 100) return 60;
                  return prev;
                });
                setGpsWarningSeconds((prev) => {
                  if (prev === null) return 60;
                  return prev;
                });
              } else if (currentRes.success && currentRes.withinRange) {
                setGpsWarningSeconds(null);
                setGpsConfidence(100);
              }
            } else if (currentRes.success && !currentRes.withinRange) {
              showNotification("We're having trouble confirming your office location. Please move closer to a window or refresh your GPS signal.", 'info');
            } else if (currentRes.success && currentRes.withinRange) {
              setGpsWarningSeconds(null);
              setGpsConfidence(100);
            }
          } catch (err) {
            console.error('Error in background geofence check:', err);
          }
        },
        (error) => {
          console.warn('Background geofencing geolocation error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    performGeofenceCheck();
    const interval = setInterval(performGeofenceCheck, 60000);

    return () => clearInterval(interval);
  }, [checkedIn, isCheckedOut, currentStatus]);

  const handleCheckIn = async () => {
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
      await executeMutationWithVersionCheck(async () => {
        const result = await checkIn(lat, lng, undefined, undefined, fingerprint, undefined, devInfo);
        return result;
      }, 'Check In');
      setGpsStatus('success');
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
  };

  const handleWFHRequest = async () => {
    if (!coords) return;
    setGpsStatus('loading');
    try {
      const fingerprint = getOrCreateFingerprint();
      await executeMutationWithVersionCheck(async () => {
        const result = await requestWFH(coords.lat, coords.lng, undefined, undefined, fingerprint);
        return result;
      }, 'WFH Request');
      setGpsStatus('success');
      setWfhRequest(null);
    } catch {
      setGpsStatus('error');
      showNotification('Failed to request WFH', 'error');
    }
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
      onConfirm: async () => {
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
      await executeMutationWithVersionCheck(async () => {
        const res = await endBreak();
        return res;
      }, 'End Break');
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
    if (currentStatus === 'On Break' && currentBreakStart) {
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
    : `${todayRecord?.duration_hours || 0}h / 9h`;
  const completedPercentage = !isCheckedOut
    ? Math.min(Math.round((productiveSeconds / (9 * 3600)) * 100), 100)
    : Math.min(Math.round(((todayRecord?.duration_hours || 0) / 9) * 100), 100);

  const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
  const daysInMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < monthStart.getDay(); i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Dynamic statistics calculation for the selected month
  const selectedMonthRecords = initialRecords.filter(r => {
    if (!r.date) return false;
    const dateObj = new Date(r.date);
    return dateObj.getMonth() === selectedMonthDate.getMonth() && dateObj.getFullYear() === selectedMonthDate.getFullYear();
  });

  const presentCount = selectedMonthRecords.filter(r => {
    const s = r.status?.toLowerCase();
    return s === 'present' || s === 'working' || s === 'logged out' || s === 'on break';
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

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonthDate(prev => {
      const nextDate = new Date(prev.getFullYear(), prev.getMonth() + (direction === 'prev' ? -1 : 1), 1);
      if (nextDate > currentMonthStart) return prev;
      if (nextDate < minMonthStart) return prev;
      
      setIsCalendarLoading(true);
      setTimeout(() => {
        setIsCalendarLoading(false);
      }, 300);
      
      return nextDate;
    });
  };

  const getStatusForDay = (day: number) => {
    const dStr = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = initialRecords.find(r => r.date === dStr);
    return record?.status?.toLowerCase() || null;
  };

  return (
    <div className="space-y-6 pb-16">
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

      {/* Workstation Validation Banners */}
      <AnimatePresence>
        {currentStatus === 'AWAITING_DESKTOP' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50/30 text-xs font-semibold font-sans shadow-2xs bg-white"
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-amber-50 text-amber-600 border-amber-200 animate-pulse mt-0.5 sm:mt-0">
                <Clock className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy-900 text-left">Awaiting Workstation Verification</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold animate-pulse">
                    Time Remaining: {countdownText}
                  </span>
                </div>
                <span className="font-medium text-zinc-600 text-xs text-left">
                  Your attendance has started successfully. To continue productive hours tracking, please open the portal on your laptop or desktop device within 10 minutes.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
              <button
                onClick={triggerDesktopVerification}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
              >
                Verify On Laptop
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentStatus === 'PRODUCTIVE_TIMER_PAUSED' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-red-200 bg-red-50/30 text-xs font-semibold font-sans shadow-2xs bg-white"
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-red-50 text-red-600 border-red-200 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-red-800 text-left">Productive Timer Paused</span>
                <span className="font-medium text-zinc-600 text-xs text-left font-sans">
                  We couldn't detect an active laptop or desktop work session yet. Please continue work from your laptop or desktop device to resume productive hours tracking.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
              <button
                onClick={handleStartBreak}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Start Break
              </button>
              <button
                onClick={() => {
                  if (todayRecord) {
                    setDisputeRecord(todayRecord);
                    setDisputeReason('Requesting Mobile-Only exception.');
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Request Exception
              </button>
              <button
                onClick={triggerDesktopVerification}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer animate-pulse"
              >
                Resume On Laptop
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentStatus === 'DESKTOP_ACTIVE' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-xs font-semibold font-sans shadow-2xs bg-white"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-emerald-50 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-emerald-800 text-left font-sans">Desktop Session Verified</span>
              <span className="font-medium text-zinc-600 text-xs text-left font-sans">
                Desktop work session verified successfully.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPS Weak Signal / Verification Warning Banner */}
      <AnimatePresence>
        {gpsWarningSeconds !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50/30 text-xs font-semibold font-sans shadow-2xs bg-white"
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-amber-50 text-amber-600 border-amber-200 animate-pulse mt-0.5 sm:mt-0">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy-900">
                    {gpsConfidence === 30 ? 'Location Verification Required' : 'GPS Signal Weak'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold">
                    Confidence: {gpsConfidence}%
                  </span>
                  {gpsWarningSuspended && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-150 text-zinc-600 font-mono font-bold uppercase animate-pulse">
                      Paused
                    </span>
                  )}
                </div>
                <span className="font-medium text-zinc-600 text-xs text-left">
                  {gpsConfidence === 30
                    ? 'GPS accuracy degraded. Verification retry in progress. Please move to an open location.'
                    : "We're having trouble confirming your office location. Please move closer to a window or refresh your GPS signal."}
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wider mt-0.5 text-left">
                  Verification countdown: {gpsWarningSeconds}s {gpsWarningSuspended && '(Paused - check connection)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
              <button
                onClick={handleDismissGpsWarning}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Dismiss for 5m
              </button>
              <button
                onClick={handleVerifyLocation}
                disabled={isVerifyingLocation}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                {isVerifyingLocation ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Verify Presence
              </button>
            </div>
          </motion.div>
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
            <div className="w-full bg-slate-900 text-white rounded-xl py-3 px-4 flex items-center justify-between border border-slate-900 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">Live System Time</span>
              </div>
              <div className="font-mono text-sm font-black tracking-widest text-slate-200">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>

            {/* Centered Hero Check-in / Check-out button */}
            <div className="w-full text-center space-y-3">
              {!checkedIn ? (
                <button
                  onClick={handleCheckIn}
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
                {isCheckedOut && (
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
              <div className="flex gap-3 pt-5 border-t border-zinc-200">
                <Button
                  variant={(currentStatus === 'Working' || currentStatus === 'Approved WFH') ? 'primary' : 'outline'}
                  disabled={(currentStatus !== 'Working' && currentStatus !== 'Approved WFH') || isBreakActionLoading}
                  onClick={handleStartBreak}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all shadow-3xs border border-zinc-200 font-sans"
                >
                  {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Break'}
                </Button>
                <Button
                  variant={currentStatus === 'On Break' ? 'primary' : 'outline'}
                  disabled={currentStatus !== 'On Break' || isBreakActionLoading}
                  onClick={handleEndBreak}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all shadow-3xs border border-zinc-200 font-sans"
                >
                  {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'End Break'}
                </Button>
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
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500 cursor-pointer text-sm font-bold font-mono transition-colors"
                  >
                    &lt;
                  </button>
                  <div className="px-2.5 py-1 rounded bg-[#E2E8F0]/40 text-[#64748B] text-[10px] font-bold uppercase tracking-wider font-mono shadow-3xs min-w-[85px] text-center">
                    {selectedMonthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase()}
                  </div>
                  <button
                    onClick={() => navigateMonth('next')}
                    disabled={isNextDisabled || isCalendarLoading}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500 cursor-pointer text-sm font-bold font-mono transition-colors"
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

                    const getStatusDotColor = (s: string | null, dayNum: number) => {
                      if (s) {
                        const statusLower = s.toLowerCase();
                        if (statusLower === 'present' || statusLower === 'working' || statusLower === 'logged out' || statusLower === 'on break' || statusLower === 'desktop_active' || statusLower === 'desktop active') return 'bg-[#10B981]';
                        if (statusLower === 'late') return 'bg-[#F59E0B]';
                        if (statusLower === 'absent' || statusLower === 'rejected wfh' || statusLower === 'productive_timer_paused' || statusLower === 'productive timer paused' || statusLower === 'timer paused') return 'bg-[#EF4444]';
                        if (statusLower.includes('wfh') || statusLower === 'half-day' || statusLower === 'awaiting_desktop' || statusLower === 'awaiting desktop' || statusLower === 'mobile_clocked_in' || statusLower === 'mobile clocked in') return 'bg-[#3B82F6]';
                        if (statusLower === 'holiday' || statusLower === 'off' || statusLower === 'weekly off') return 'bg-[#CBD5E1]';
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
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min((r.duration_hours / 9) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-navy-900 font-mono">{r.duration_hours}h</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-100">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                  {myDisputes.some(d => d.attendance_id === r.id) ? (
                    <span className={cn(
                      myDisputes.find(d => d.attendance_id === r.id).status === 'APPROVED' ? "text-emerald-600" :
                      myDisputes.find(d => d.attendance_id === r.id).status === 'REJECTED' ? "text-red-650" : "text-amber-600"
                    )}>
                      Dispute: {myDisputes.find(d => d.attendance_id === r.id).status}
                    </span>
                  ) : (
                    <span className="text-zinc-450">No disputes</span>
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
                    File Dispute
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
                            style={{ width: `${Math.min((r.duration_hours / 9) * 100, 100)}%` }} 
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-navy-900 font-mono">{r.duration_hours}h</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {myDisputes.some(d => d.attendance_id === r.id) ? (
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-mono",
                            myDisputes.find(d => d.attendance_id === r.id).status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            myDisputes.find(d => d.attendance_id === r.id).status === 'REJECTED' ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            Dispute: {myDisputes.find(d => d.attendance_id === r.id).status}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setDisputeRecord(r);
                              setDisputeReason('');
                            }}
                            className="px-2 py-1 bg-zinc-55 hover:bg-zinc-100 border border-zinc-200 rounded text-[10px] font-bold text-navy-900 transition-colors uppercase tracking-wider font-mono cursor-pointer"
                          >
                            File Dispute
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
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight">File Attendance Dispute</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                      Session Date: {new Date(disputeRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">
                      Dispute Category
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
                      Dispute Reason / Explanation (Mandatory)
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
    </div>
  );
}
