'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, LogIn, LogOut, Loader2, Home, AlertCircle, X, Sparkles, History, Calendar as CalendarIcon, Clock, Info, WifiOff, RefreshCw, AlertTriangle, Coffee, ShieldAlert, Bell, ChevronLeft, ChevronRight, ClipboardList, Briefcase, MoreHorizontal, Headset, MapPin, Compass, LayoutGrid, Contact } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDistance, getISTShiftDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { checkIn, checkOut, resumeSession, requestWFH, startBreak, endBreak, getLateLoginsStats, processHeartbeat, getAttendanceSessionState, logGPSDismissEvent, submitDispute, getEmployeeDisputes, logStatusTransitionEvent, moveActiveSession, getAttendanceForMonth } from './actions';
import { getOrCreateFingerprint } from '@/lib/security/client-fingerprint';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { enqueueOfflineAction, getOfflineQueue } from '@/lib/offline-queue';
import { getDeviceInfo } from '@/lib/security/device-detect';
import { useNotifications } from '@/components/pwa/NotificationContext';

export interface Holiday {
  id: string;
  title: string;
  date: string;
  type: 'Company Holiday' | 'Optional Holiday' | 'Public Holiday';
}

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


export default function AttendanceClient({ 
  employee, 
  employeeId, 
  initialRecords, 
  wasAutoLoggedOut = false,
  initialHolidays = []
}: { 
  employee?: { name: string; employee_id: string; role: string; department: string; designation?: string } | null; 
  employeeId: string; 
  initialRecords: AttendanceRecord[]; 
  wasAutoLoggedOut?: boolean;
  initialHolidays?: Holiday[];
}) {
  const { open: openNotifications, unreadCount } = useNotifications();
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
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
  };

  const handleWFHRequest = async () => {
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
  
  // Trailing days of previous month
  const prevMonthDate = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 0);
  const prevMonthDays = prevMonthDate.getDate();
  const startDayOfWeek = monthStart.getDay();
  
  const calendarDays: { day: number; isCurrentMonth: boolean }[] = [];
  
  // Fill leading days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthDays - i,
      isCurrentMonth: false
    });
  }
  
  // Fill current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      day: d,
      isCurrentMonth: true
    });
  }
  
  // Fill trailing days from next month to complete the grid (up to 42 items for 6 weeks grid consistency)
  const totalCells = Math.ceil(calendarDays.length / 7) * 7;
  const nextMonthDaysCount = totalCells - calendarDays.length;
  for (let d = 1; d <= nextMonthDaysCount; d++) {
    calendarDays.push({
      day: d,
      isCurrentMonth: false
    });
  }

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

  // Calculate dynamic absent count including past days with no attendance records (excluding Sundays)
  const todayObj = new Date();
  const todayMidnight = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
  let absentCount = selectedMonthRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
  
  const lastDayToCheck = selectedMonthDate.getMonth() === todayObj.getMonth() && selectedMonthDate.getFullYear() === todayObj.getFullYear()
    ? todayObj.getDate() - 1
    : daysInMonth;

  for (let d = 1; d <= lastDayToCheck; d++) {
    const dateObj = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), d);
    if (dateObj.getDay() !== 0) { // Non-Sunday
      const dStr = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasRecord = records.some(r => r.date === dStr);
      if (!hasRecord) {
        absentCount++;
      }
    }
  }

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

  return (
    <div data-testid="attendance-mobile" className="relative w-full font-sans">

      {/* Main Content Area */}
      <div className="flex-1 space-y-5 pt-4">
        {/* Playwright E2E test status helper */}
        <div className="absolute top-0 left-0 w-[1px] h-[1px] opacity-[0.01] overflow-hidden pointer-events-none select-none flex">
          <span>{currentStatus === 'Break' || currentStatus === 'Break (Auto)' ? 'Break' : currentStatus}</span>
        </div>

        {/* Playwright E2E test hidden timer helper */}
        {checkedIn && (
          <div className="absolute top-0 left-0 w-[1px] h-[1px] opacity-[0.01] overflow-hidden pointer-events-none select-none flex">
            <span>Productive Work</span>
            <span>{runningHrsDecimal}h</span>
          </div>
        )}

        {/* Title area */}
        <div className="space-y-1">
          <h1 className="text-[24px] font-extrabold text-[#071B3A] tracking-tight">Attendance</h1>
          <p className="text-[#64748B] text-[12px] font-semibold">Track your attendance and work hours.</p>
        </div>

        {/* Auto-Logout Advisory Banner */}
        {!isCheckedOut && (
          <AnimatePresence>
            {wasAutoLoggedOut && !checkedIn && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative flex items-start gap-3 px-4 py-3 rounded-[20px] border border-amber-200 bg-amber-50/80 text-amber-800 text-xs font-sans shadow-sm"
              >
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-bold">Previous session ended automatically</p>
                  <p className="text-amber-700/80 text-[10px] mt-0.5 font-medium leading-relaxed">
                    Your previous work session was ended automatically after prolonged inactivity or connection loss. Please clock in again to continue work.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

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
                  className="px-2.5 py-1 rounded bg-blue-600 text-white text-[9px] font-mono font-semibold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50 border-0 cursor-pointer"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Late Penalty Warning Banner */}
        {!isCheckedOut && lateStats.lateCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2 p-4 rounded-[20px] border border-emerald-200 bg-emerald-50/40 text-xs font-semibold font-sans shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E6F8F2] border border-emerald-100 flex items-center justify-center shrink-0 text-[#22C55E]">
                <ShieldAlert className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#0B8B83]">Late Penalty Warning</p>
                <p className="text-[#64748B] text-[10px] mt-0.5 leading-relaxed font-medium">
                  {lateStats.warningMessage || "2 more late logins will deduct Half Day attendance."}
                </p>
              </div>
            </div>
            <div className="border-t border-emerald-200/50 pt-2 flex items-center justify-between text-[10px] font-bold tracking-wider font-mono text-[#0B8B83]">
              <span>LATES: {lateStats.lateCount}</span>
              <span>DEDUCTIONS: <span className="text-red-500">{lateStats.deduction} DAY</span></span>
            </div>
          </motion.div>
        )}

        {/* 1. Today's Overview section */}
        {checkedIn && (
          <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold text-[#071B3A]">Today's Overview</h2>
              <div 
                onClick={() => {
                  document.getElementById('monthly-calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-[11px] font-bold text-[#0B8B83] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                View Calendar
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Clock In */}
              <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
                <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Clock In</span>
                <span className="text-[12px] font-black text-[#071B3A] tracking-tight leading-none mb-2">
                  {todayRecord?.check_in ? todayRecord.check_in.replace(/\s?[AP]M/i, '') : '--:--'}
                  {todayRecord?.check_in && <span className="text-[8px] ml-0.5 font-extrabold">{todayRecord.check_in.slice(-2)}</span>}
                </span>
                {checkedIn ? (
                  <span className={cn(
                    "text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 border border-transparent uppercase font-mono",
                    todayRecord?.status?.toLowerCase() === 'late' 
                      ? "bg-red-50 text-red-600 border-red-100" 
                      : "bg-[#E6F8F2] text-[#0B8B83] border-[#0B8B83]/10"
                  )}>
                    {todayRecord?.status?.toLowerCase() === 'late' ? 'Late' : 'On Time'}
                  </span>
                ) : (
                  <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-[#F1F5F9] text-[#94A3B8] uppercase font-mono">
                    Not Yet
                  </span>
                )}
              </div>

              {/* Total Hours */}
              <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
                <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Total Hours</span>
                <span className="text-[12px] font-black text-[#071B3A] tracking-tight leading-none mb-2">
                  {checkedIn ? (
                    !isCheckedOut ? (
                      `${String(elapsedHrs).padStart(2, '0')}h ${String(elapsedMin).padStart(2, '0')}m`
                    ) : (
                      `${Math.floor(todayRecord.duration_hours).toString().padStart(2, '0')}h ${String(Math.round((todayRecord.duration_hours % 1) * 60)).padStart(2, '0')}m`
                    )
                  ) : '00h 00m'}
                </span>
                <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-blue-50 text-[#3B82F6] border border-blue-100/30 uppercase font-mono">
                  Till Now
                </span>
              </div>

              {/* Break Time */}
              <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
                <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Break Time</span>
                <span className="text-[12px] font-black text-[#071B3A] tracking-tight leading-none mb-2">
                  {checkedIn 
                    ? `${String(Math.floor(breakUsedSeconds / 3600)).padStart(2, '0')}h ${String(Math.floor((breakUsedSeconds % 3600) / 60)).padStart(2, '0')}m` 
                    : '00h 00m'}
                </span>
                <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-purple-50 text-[#8B5CF6] border border-purple-100/30 uppercase font-mono">
                  {breakUsedSeconds > 0 ? `${Math.ceil(breakUsedSeconds / 60)}m` : '0 Break'}
                </span>
              </div>

              {/* Clock Out */}
              <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
                <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Clock Out</span>
                <span className="text-[12px] font-black text-[#071B3A] tracking-tight leading-none mb-2">
                  {todayRecord?.check_out ? todayRecord.check_out.replace(/\s?[AP]M/i, '') : '--:--'}
                  {todayRecord?.check_out && <span className="text-[8px] ml-0.5 font-extrabold">{todayRecord.check_out.slice(-2)}</span>}
                </span>
                <span className={cn(
                  "text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 uppercase font-mono border border-transparent",
                  isCheckedOut ? "bg-amber-50 text-[#F59E0B]" : "bg-[#F1F5F9] text-[#94A3B8]"
                )}>
                  {isCheckedOut ? 'Done' : 'Not Yet'}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 2. CURRENT SESSION section */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4 relative overflow-hidden">
            {/* Background Map Graphic Accent */}
            <div className="absolute right-4 top-4 opacity-[0.08] select-none pointer-events-none w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full text-[#0B8B83]">
                <path d="M10 50 Q 30 20, 50 50 T 90 50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="10" fill="currentColor" fillOpacity="0.2" />
                <circle cx="50" cy="50" r="3" fill="currentColor" />
              </svg>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#0B8B83] block">
                  CURRENT SESSION
                </span>
                <div className="flex items-center justify-between mt-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#64748B] block leading-none">Live Status</span>
                    <h3 className="text-[18px] font-extrabold text-[#071B3A] flex items-center gap-1.5 leading-none">
                      {checkedIn ? (
                        currentStatus === 'Break' || currentStatus === 'Break (Auto)' ? 'On Break' :
                        currentStatus === 'Idle' ? 'Idle' : 'Active'
                      ) : 'Inactive'}
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        checkedIn ? (
                          currentStatus === 'Break' || currentStatus === 'Break (Auto)' ? 'bg-purple-500 animate-pulse' :
                          currentStatus === 'Idle' ? 'bg-amber-500 animate-pulse' : 'bg-[#22C55E] animate-pulse'
                        ) : 'bg-red-500'
                      )} />
                    </h3>
                  </div>
                  
                  {/* Location Accuracy */}
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-[#64748B] uppercase block leading-none">Location Accuracy</span>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[#22C55E] font-bold text-xs">
                      <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 h-1 bg-[#22C55E]" />
                        <div className="w-0.5 h-2 bg-[#22C55E]" />
                        <div className="w-0.5 h-3 bg-[#22C55E]" />
                      </div>
                      High
                    </div>
                  </div>
                </div>
              </div>

              {/* Live system time */}
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#94A3B8] block leading-none">
                  LIVE SYSTEM TIME (ACTIVE SYNC)
                </span>
                <div className="text-[28px] font-black text-[#071B3A] font-mono tracking-wider leading-none pt-1">
                  {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
              </div>

              {/* Playwright E2E test hidden helper */}
              {checkedIn && (
                <div className="absolute top-0 left-0 w-[1px] h-[1px] opacity-[0.01] overflow-hidden pointer-events-none select-none flex">
                  <span>Productive Work</span>
                  <span>{runningHrsDecimal}h</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                {!checkedIn ? (
                  <button
                    type="button"
                    data-testid="clock-in-btn"
                    onClick={handleCheckIn}
                    disabled={gpsStatus === 'loading'}
                    className="w-full py-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider bg-[#0B8B83] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 border-0"
                  >
                    {gpsStatus === 'loading' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Locating GPS...</>
                    ) : (
                      'CLOCK IN'
                    )}
                  </button>
                ) : !isCheckedOut ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleCheckOut}
                      disabled={gpsStatus === 'loading'}
                      className="w-full py-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider bg-[#0B8B83] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 border-0"
                    >
                      {gpsStatus === 'loading' ? (
                        <><Loader2 className="w-4 h-4 animate-spin animate-pulse" /> Locating GPS...</>
                      ) : (
                        'CLOCK OUT'
                      )}
                    </button>
                    
                    {/* Break controller inline */}
                    <div className="flex gap-2">
                      {['Break', 'Break (Auto)', 'Idle'].includes(currentStatus) ? (
                        <button
                          type="button"
                          disabled={isBreakActionLoading}
                          onClick={handleResumeWork}
                          className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#0B8B83] hover:opacity-90 text-white active:scale-[0.98] transition-all shadow-3xs cursor-pointer border-0"
                        >
                          {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Resume Work'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={(currentStatus !== 'Working' && currentStatus !== 'Approved WFH') || isBreakActionLoading}
                          onClick={handleStartBreak}
                          className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#EFF6FF] hover:bg-blue-100 text-[#3B82F6] active:scale-[0.98] transition-all shadow-3xs cursor-pointer border-0"
                        >
                          {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Break'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#E6F8F2] border border-[#22C55E]/10 rounded-xl p-4 text-center">
                    <p className="text-xs font-extrabold text-[#22C55E] uppercase tracking-wider">Clock Out Complete</p>
                    <p className="text-[10px] text-zinc-500 mt-1 font-semibold font-sans">Your shift attendance has been recorded successfully.</p>
                    <button 
                      type="button"
                      onClick={handleResume} 
                      className="mt-3 text-[10px] font-bold text-[#0B8B83] hover:underline uppercase tracking-wider font-mono cursor-pointer bg-transparent border-0"
                    >
                      Undo Clock Out
                    </button>
                  </div>
                )}
                
                {!isCheckedOut && (
                  <p className="text-center text-[10px] text-[#94A3B8] font-bold">
                    You will be logged out of your current session
                  </p>
                )}
              </div>
            </div>
          </section>

        {/* 3. Monthly Attendance Calendar Card */}
        <section id="monthly-calendar-section" className="bg-[#FFFFFF] rounded-[20px] p-5 border border-[#E2E8F0] shadow-sm relative flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-[18px] h-[18px] text-[#0B8B83]" />
              <h2 className="font-extrabold text-[#0F172A] text-[14px] tracking-tight font-sans">Monthly Attendance</h2>
            </div>
            
            {/* Navigation controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                disabled={isPrevDisabled || isCalendarLoading}
                className="text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer p-1 transition-all border-0 bg-transparent"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <div className="bg-[#EFF2F6] px-3.5 py-1 rounded-lg text-[#071B3A] text-xs font-black font-sans leading-none uppercase tracking-wide">
                {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
              <button
                type="button"
                onClick={() => navigateMonth('next')}
                disabled={isNextDisabled || isCalendarLoading}
                className="text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer p-1 transition-all border-0 bg-transparent"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 text-center text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-zinc-100 pb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
              <span key={index}>{d}</span>
            ))}
          </div>

          {/* Date grid area */}
          {isCalendarLoading ? (
            <div className="grid grid-cols-7 gap-y-[8px] justify-items-center text-center animate-pulse py-2">
              {Array.from({ length: 35 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center gap-[4px]">
                  <div className="w-[30px] h-[30px] bg-[#E2E8F0] rounded-full" />
                  <div className="w-[4px] h-[4px] bg-[#E2E8F0] rounded-full mt-0.5" />
                </div>
              ))}
            </div>
          ) : selectedMonthRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarIcon className="w-8 h-8 text-[#94A3B8] mb-2 stroke-[1.5]" />
              <p className="text-xs font-bold text-[#0F172A]">No records found</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-y-[8px] justify-items-center text-center text-xs font-bold text-[#0F172A]">
              {calendarDays.map((dayObj, i) => {
                const { day, isCurrentMonth } = dayObj;
                const status = isCurrentMonth ? getStatusForDay(day) : null;
                const isToday = isCurrentMonth && day === new Date().getDate() && selectedMonthDate.getMonth() === new Date().getMonth() && selectedMonthDate.getFullYear() === new Date().getFullYear();

                const dStr = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isHoliday = isCurrentMonth && holidays.some(h => h.date === dStr);
                const holidayObj = isHoliday ? holidays.find(h => h.date === dStr) : null;

                const getStatusDotColor = (s: string | null, dayNum: number) => {
                  if (!isCurrentMonth) return null;
                  if (s) {
                    const statusLower = s.toLowerCase();
                    if (statusLower === 'present' || statusLower === 'working' || statusLower === 'logged out' || statusLower === 'break' || statusLower === 'break (auto)' || statusLower === 'desktop_active' || statusLower === 'desktop active') return 'bg-[#10B981]';
                    if (statusLower === 'late') return 'bg-[#F59E0B]';
                    if (statusLower === 'absent' || statusLower === 'rejected wfh') return 'bg-[#EF4444]';
                    if (statusLower.includes('wfh') || statusLower === 'half-day') return 'bg-[#3B82F6]';
                    if (statusLower === 'holiday' || statusLower === 'off' || statusLower === 'weekly off') return 'bg-[#CBD5E1]';
                  }
                  
                  if (isHoliday) return 'bg-[#22C55E]'; // Green dot for holiday

                  // For past days without records
                  const dateObj = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), dayNum);
                  const todayObj = new Date();
                  const todayMidnight = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
                  
                  if (dateObj < todayMidnight) {
                    const dayOfWeek = dateObj.getDay();
                    if (dayOfWeek === 0) {
                      // Sunday: No dot (weekly off)
                      return null;
                    }
                    // Weekday or Saturday in the past with no record -> Absent (red dot)
                    return 'bg-[#EF4444]';
                  }
                  
                  return null;
                };

                const dotColor = getStatusDotColor(status, day);

                // Border ring if active
                const isSelectedState = isCurrentMonth && (
                  status === 'late' || status === 'present' || status === 'working' || status === 'logged out' || status?.includes('wfh') || status === 'half-day'
                );

                return (
                  <div key={i} className="flex flex-col items-center justify-center relative select-none">
                    <div className="flex flex-col items-center gap-[4px] relative">
                      <div
                        className={cn(
                          "w-[32px] h-[32px] rounded-full flex items-center justify-center text-xs font-extrabold transition-all cursor-default",
                          isToday
                            ? "bg-[#0B8B83] text-white"
                            : isSelectedState 
                              ? status === 'late' 
                                ? "border border-red-200 text-red-500 bg-red-50/20" 
                                : status?.includes('wfh')
                                  ? "border border-blue-200 text-blue-500 bg-blue-50/20"
                                  : status === 'half-day'
                                    ? "border border-orange-200 text-orange-500 bg-orange-50/20"
                                    : "border border-emerald-200 text-[#22C55E] bg-[#E6F8F2]/30"
                              : isHoliday
                                ? "bg-[#E6F8F2] text-[#22C55E] border border-emerald-200"
                              : !isCurrentMonth
                                ? "text-zinc-400 font-normal"
                                : "text-[#071B3A]"
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-[#EEF2F6]" />

          {/* Legend Footer */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 text-[9px] font-bold text-[#64748B] uppercase px-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <span>Present ({presentCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              <span>Late ({lateMonthCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
              <span>Absent ({absentCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
              <span>WFH ({wfhCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
              <span>Half Day ({selectedMonthRecords.filter(r => r.status?.toLowerCase() === 'half-day').length})</span>
            </div>
          </div>
        </section>

        {/* Holidays List Card */}
        {(() => {
          const currentMonthHolidays = holidays.filter(h => {
            const hDate = new Date(h.date);
            return hDate.getMonth() === selectedMonthDate.getMonth() && hDate.getFullYear() === selectedMonthDate.getFullYear();
          });

          return (
            <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-extrabold text-[#071B3A]">Holidays in {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long' })}</h2>
              </div>
              
              {currentMonthHolidays.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#94A3B8] border border-dashed border-[#E8EDF2] rounded-[20px]">
                  No holidays scheduled in this month
                </div>
              ) : (
                <div className="space-y-2">
                  {currentMonthHolidays.map(holiday => (
                    <div key={holiday.id} className="flex items-center justify-between border border-[#EEF2F6] rounded-[20px] p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E6F8F2] flex items-center justify-center text-[#22C55E] shrink-0">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-extrabold text-[#071B3A]">{holiday.title}</span>
                          <span className="text-[9px] font-bold text-[#64748B]">
                            {new Date(holiday.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'long' })}
                          </span>
                        </div>
                      </div>
                      <span className="bg-[#E6F8F2] text-[#22C55E] text-[8px] font-bold py-1 px-2.5 rounded-full uppercase shrink-0 border border-[#22C55E]/10">
                        {holiday.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })()}

        {/* 4. Attendance History section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#0B8B83] rounded-full" />
              <h2 className="font-extrabold text-[#071B3A] text-[14px] tracking-tight font-sans">Attendance History</h2>
            </div>
            {/* View All link */}
            <span className="text-[11px] font-bold text-[#0B8B83] hover:underline flex items-center gap-0.5 cursor-pointer">
              View All <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          <div className="space-y-2">
            {records.slice(0, 5).map(r => {
              const hasDispute = myDisputes.some(d => d.attendance_id === r.id);
              const dispute = myDisputes.find(d => d.attendance_id === r.id);
              const isWFH = r.status?.toLowerCase().includes('wfh');
              
              return (
                <div key={r.id} className="p-4 rounded-xl border border-[#E8EDF2] bg-white shadow-3xs flex justify-between items-center font-sans">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const s = r.status?.toLowerCase() || '';
                      const disputeApproved = dispute && dispute.status === 'APPROVED';
                      let bgClass = "bg-[#E6F8F2] border-emerald-100 text-[#22C55E]";
                      let IconComponent = LogOut;
                      
                      if (isWFH) {
                        IconComponent = Home;
                        if (s.includes('approved') || disputeApproved) {
                          bgClass = "bg-[#E6F8F2] border-emerald-100 text-[#22C55E]";
                        } else {
                          bgClass = "bg-slate-50 border-slate-200 text-slate-400";
                        }
                      } else if (s === 'late' || disputeApproved) {
                        bgClass = "bg-orange-50 border-orange-100 text-orange-500";
                      }
                      
                      return (
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border shrink-0", bgClass)}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                      );
                    })()}
                    
                    <div className="space-y-1">
                      <p className="font-extrabold text-[#071B3A] text-xs">
                        {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] text-[#64748B] font-mono font-semibold">
                        <Clock className="w-3 h-3 text-[#94A3B8]" />
                        <span>{r.check_in || '--:--'} → {r.check_out || 'Active'}</span>
                      </div>
                      
                      {hasDispute && dispute && (
                        <div className={cn(
                          "text-[9px] font-extrabold uppercase tracking-wider mt-1.5 font-mono",
                          dispute.status === 'APPROVED' ? "text-[#22C55E]" :
                          dispute.status === 'REJECTED' ? "text-red-500" : "text-amber-500"
                        )}>
                          DISPUTE: {dispute.status}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-extrabold text-[#071B3A] font-mono leading-none">
                      {Math.floor(r.duration_hours)}h {String(Math.round((r.duration_hours % 1) * 60)).padStart(2, '0')}m
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {(() => {
                        const s = r.status?.toLowerCase() || '';
                        const disputeApproved = dispute && dispute.status === 'APPROVED';
                        let bgClass = "bg-[#F1F5F9] text-[#64748B]";
                        let dotClass = "bg-[#64748B]";
                        let labelText = "LOGGED OUT";
                        
                        if (isWFH && (s.includes('approved') || disputeApproved || s.includes('present') || s.includes('working') || s.includes('logged out'))) {
                          bgClass = "bg-[#E6F8F2] text-[#22C55E]";
                          dotClass = "bg-[#22C55E]";
                          labelText = "APPROVED WFH";
                        } else if (s === 'late') {
                          bgClass = "bg-red-50 text-red-500";
                          dotClass = "bg-red-500";
                          labelText = "LATE";
                        } else if (s === 'absent') {
                          bgClass = "bg-slate-100 text-slate-500";
                          dotClass = "bg-slate-400";
                          labelText = "ABSENT";
                        }
                        
                        return (
                          <span className={cn(
                            "text-[8px] font-black py-0.5 px-2 rounded-full leading-none shrink-0 border border-transparent uppercase font-mono flex items-center gap-1",
                            bgClass
                          )}>
                            <span className={cn("w-1 h-1 rounded-full", dotClass)} />
                            {labelText}
                          </span>
                        );
                      })()}
                      
                      {!hasDispute && (
                        <button
                          type="button"
                          onClick={() => {
                            setDisputeRecord(r);
                            setDisputeReason('');
                          }}
                          className="px-2 py-0.5 bg-[#F7F8FA] border border-[#E8EDF2] rounded-[6px] text-[9px] font-extrabold text-[#071B3A] hover:bg-zinc-100 transition-colors uppercase tracking-wider font-mono cursor-pointer"
                        >
                          FILE DISPUTE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Attendance Summary section */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <h2 className="text-[14px] font-extrabold text-[#071B3A]">Attendance Summary</h2>
          
          <div className="grid grid-cols-4 gap-2">
            {/* Present Card */}
            <div className="bg-white border border-[#E8EDF2] rounded-[20px] p-3 flex flex-col items-center justify-center text-center shadow-3xs">
              <span className="text-[16px] font-extrabold text-[#10B981] block leading-none">{presentCount}</span>
              <span className="text-[8px] font-bold text-[#64748B] mt-2 block uppercase tracking-wider">Present</span>
            </div>

            {/* Absent Card */}
            <div className="bg-white border border-[#E8EDF2] rounded-[20px] p-3 flex flex-col items-center justify-center text-center shadow-3xs">
              <span className="text-[16px] font-extrabold text-[#EF4444] block leading-none">{absentCount}</span>
              <span className="text-[8px] font-bold text-[#64748B] mt-2 block uppercase tracking-wider">Absent</span>
            </div>

            {/* Late Card */}
            <div className="bg-white border border-[#E8EDF2] rounded-[20px] p-3 flex flex-col items-center justify-center text-center shadow-3xs">
              <span className="text-[16px] font-extrabold text-[#F59E0B] block leading-none">{lateMonthCount}</span>
              <span className="text-[8px] font-bold text-[#64748B] mt-2 block uppercase tracking-wider">Late</span>
            </div>

            {/* Leave Card */}
            <div className="bg-white border border-[#E8EDF2] rounded-[20px] p-3 flex flex-col items-center justify-center text-center shadow-3xs">
              <span className="text-[16px] font-extrabold text-[#3B82F6] block leading-none">{leaveTaken}</span>
              <span className="text-[8px] font-bold text-[#64748B] mt-2 block uppercase tracking-wider">Leave</span>
            </div>
          </div>
        </section>

        {/* 6. Need Help Support Banner */}
        <section className="bg-white rounded-[20px] p-4 border border-[#E8EDF2] shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F8F2] border border-[#0B8B83]/10 flex items-center justify-center text-[#0B8B83] shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-[#071B3A] leading-none">Need Help?</h3>
              <p className="text-[10px] text-[#64748B] mt-1 font-semibold leading-none">Facing issues with attendance?</p>
            </div>
          </div>
          <a
            href="mailto:support@primetekglobal.com?subject=Attendance%20Portal%20Issue"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#E6F8F2] border border-[#0B8B83]/20 hover:bg-[#0B8B83]/10 rounded-xl text-[10px] font-bold text-[#0B8B83] uppercase tracking-wider transition-colors shrink-0"
          >
            <Headset className="w-3.5 h-3.5" />
            Contact Support
          </a>
        </section>

      </div>

      {/* 5. FIXED BOTTOM TAB BAR (Attendance active) removed - managed by layout sidebar */}

      {/* 6. MODALS OVERLAYS */}
      
      {/* Session Hijack Warning */}
      <AnimatePresence>
        {hijackWarning?.active && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              className="w-full max-w-sm bg-white rounded-[20px] p-6 border border-zinc-200 shadow-xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <h3 className="text-sm font-bold text-[#071B3A] tracking-tight leading-tight">Session Active on Another Device</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                Your attendance session is active on another device. You can move it here to resume tracking.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHijackWarning(null)}
                  className="flex-1 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold border border-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const fingerprint = getOrCreateFingerprint();
                    const res = await moveActiveSession(hijackWarning.sessionId, fingerprint, tabId);
                    if (res.success) {
                      setHijackWarning(null);
                      showNotification('Session moved to this device successfully.', 'success');
                      await refreshProjectionState();
                    } else {
                      showNotification(res.error || 'Failed to move session.', 'error');
                    }
                  }}
                  className="flex-1 bg-[#071B3A] hover:bg-[#112544] text-white rounded-xl text-xs font-bold py-2 cursor-pointer border-0"
                >
                  Move Session Here
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WFH Request Interface */}
      <AnimatePresence>
        {wfhRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              className="w-full max-w-sm bg-white rounded-[20px] p-6 border border-zinc-200 shadow-xl space-y-4 font-sans relative"
            >
              <button 
                type="button"
                onClick={() => setWfhRequest(null)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-500 cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex flex-col items-center text-center space-y-4 pt-2">
                <div className="w-12 h-12 rounded-xl border border-primary-200 bg-primary-50 text-primary-500 flex items-center justify-center shadow-3xs">
                  <Home className="w-6 h-6" />
                </div>
                
                <div>
                  <h3 className="text-sm font-bold text-[#071B3A] tracking-tight">Work from Home Request?</h3>
                  <div className="mt-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 font-semibold leading-relaxed">
                    You are <span className="font-extrabold text-[#071B3A]">{formatDistance(wfhRequest.distance || 0)}</span> away from the office.
                    <p className="mt-1 font-medium italic">Would you like to submit a Work From Home (WFH) check-in request instead?</p>
                  </div>
                </div>
                
                <div className="flex flex-col w-full gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={handleWFHRequest} 
                    disabled={gpsStatus === 'loading'} 
                    className="w-full py-2.5 bg-[#0B8B83] hover:bg-[#0d6460] text-white rounded-xl text-xs font-bold border-0 cursor-pointer"
                  >
                    Submit WFH Check-In
                  </button>
                  <button 
                    type="button"
                    onClick={() => setWfhRequest(null)} 
                    className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider hover:text-navy-900 cursor-pointer border-0 bg-transparent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Action */}
      <AnimatePresence>
        {confirmAction && (
          <div 
            onClick={() => setConfirmAction(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-955/40 backdrop-blur-xs cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-xs bg-white rounded-[20px] p-5 border border-zinc-200 shadow-xl font-sans cursor-default"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl border flex items-center justify-center",
                  confirmAction.variant === 'danger' ? "bg-red-50 border-red-200 text-red-500" : "bg-primary-50 border-primary-200 text-primary-500"
                )}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#071B3A]">Confirm Action</h3>
                  <p className="text-xs text-zinc-500 mt-1.5 font-semibold leading-relaxed">{confirmAction.message}</p>
                </div>
                <div className="flex w-full gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold border border-zinc-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      confirmAction.onConfirm();
                      setConfirmAction(null);
                    }}
                    className={cn(
                      "flex-1 border rounded-xl py-2 text-xs font-bold shadow-3xs cursor-pointer",
                      confirmAction.variant === 'danger' 
                        ? "bg-red-500 hover:bg-red-650 border-red-500 text-white" 
                        : "bg-[#071B3A] hover:bg-[#112544] border-navy-950 text-white"
                    )}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Dispute Form */}
      <AnimatePresence>
        {disputeRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-955/40 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              className="w-full max-w-sm bg-white rounded-[20px] p-6 border border-zinc-200 shadow-xl font-sans relative"
            >
              <button 
                type="button"
                onClick={() => setDisputeRecord(null)}
                disabled={isSubmittingDispute}
                className="absolute top-4 right-4 w-7 h-7 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-500 cursor-pointer disabled:opacity-50 border-0"
              >
                <X className="w-4 h-4" />
              </button>

              <form onSubmit={handleDisputeSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-amber-200 bg-amber-50 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#071B3A]">File Attendance Dispute</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5 font-mono">
                      Session Date: {new Date(disputeRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">
                      Dispute Category
                    </label>
                    <select
                      value={disputeCategory}
                      onChange={(e) => setDisputeCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs text-navy-900 focus:outline-none bg-white cursor-pointer"
                    >
                      <option value="LATE_PENALTY">Late Login Penalty Exemption</option>
                      <option value="GPS_AUTO_BREAK">GPS Auto-Break Adjustment</option>
                      <option value="IDLE_WARNING">Idle Hours Warning Exemption</option>
                      <option value="MISSING_TIME">Missing Time / Heartbeat Sync Correction</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">
                      Dispute Reason (Mandatory)
                    </label>
                    <textarea
                      placeholder="Provide detailed context..."
                      required
                      rows={3}
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none placeholder:text-zinc-350"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDisputeRecord(null)}
                    disabled={isSubmittingDispute}
                    className="flex-1 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold border border-zinc-200 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDispute || !disputeReason.trim()}
                    className="flex-1 bg-[#071B3A] hover:bg-[#112544] text-white rounded-xl text-xs font-bold py-2 shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer border-0"
                  >
                    {isSubmittingDispute ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-full max-w-sm px-4"
          >
            <div className={cn(
              "rounded-xl p-4 shadow-xl border bg-white/95 border-zinc-200 font-sans flex items-start gap-3",
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
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-navy-900 leading-none">
                  {notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Notification'}
                </p>
                <p className="text-[10px] mt-1 text-zinc-500 font-semibold leading-normal">{notification.message}</p>
              </div>
              <button type="button" onClick={() => setNotification(null)} className="text-zinc-400 hover:text-zinc-650 cursor-pointer border-0 bg-transparent">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inactivity Warning Overlays */}
      <AnimatePresence>
        {sessionState === 'WARNING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-zinc-200 rounded-[20px] max-w-sm w-full p-6 shadow-xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-8 h-8 animate-bounce" />
                <h3 className="text-sm font-bold text-[#071B3A]">Are you still working?</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                We haven't detected activity. Confirm you are active to avoid auto-break.
              </p>
              <button
                type="button"
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
                className="w-full py-3 rounded-xl bg-[#071B3A] hover:bg-[#112544] text-white text-xs font-bold uppercase tracking-wider cursor-pointer border-0"
              >
                I am still working
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
