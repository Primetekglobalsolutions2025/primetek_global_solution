'use client';

import { useEffect, useState, useRef } from 'react';
import { getActiveSessionForToday, processHeartbeat, logStatusTransitionEvent, hasPendingClockOutRequestForToday } from '@/app/employee/attendance/actions';
import { getDeviceInfo } from '@/lib/security/device-detect';
import { getOrCreateFingerprint } from '@/lib/security/client-fingerprint';


interface AttendanceRecordSimple {
  id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  active_device_fingerprint: string | null;
  active_tab_id: string | null;
}

export default function AttendanceTracker({ employeeId }: { employeeId: string }) {
  const LEASE_KEY = 'primetek_attendance_leader_lease_' + employeeId;
  const [record, setRecord] = useState<AttendanceRecordSimple | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [isClockOutPending, setIsClockOutPending] = useState(false);
  
  const isLeaderRef = useRef(false);
  const recordRef = useRef<AttendanceRecordSimple | null>(null);
  const tabIdRef = useRef('');

  // Local activity counters
  const clickCount = useRef(0);
  const keypressCount = useRef(0);
  const pointerMovesCount = useRef(0);
  const sequenceNumber = useRef(2);

  // Initialize unique Tab ID
  useEffect(() => {
    tabIdRef.current = Math.random().toString(36).substring(2, 11);
  }, []);

  // Fetch active session state from DB
  const refreshActiveSession = async () => {
    try {
      const [sessionRes, pendingRes] = await Promise.all([
        getActiveSessionForToday(),
        hasPendingClockOutRequestForToday()
      ]);
      
      if (sessionRes.success && sessionRes.record) {
        setRecord(sessionRes.record);
        recordRef.current = sessionRes.record;
      } else {
        setRecord(null);
        recordRef.current = null;
      }

      if (pendingRes.success && pendingRes.pending !== undefined) {
        setIsClockOutPending(pendingRes.pending);
      } else {
        setIsClockOutPending(false);
      }
    } catch (err) {
      console.error('[AttendanceTracker] Error refreshing session:', err);
    }
  };

  useEffect(() => {
    if (!employeeId) return;

    // Initial fetch on mount
    refreshActiveSession();

    // Listen to tab refresh events (e.g. from Clock In / Clock Out)
    const bc = new BroadcastChannel('attendance_tabs');
    bc.onmessage = (e) => {
      if (e.data.type === 'STATE_REFRESH') {
        console.log('[AttendanceTracker] Broadcast received. Syncing session status...');
        refreshActiveSession();
      }
    };

    return () => {
      bc.close();
    };
  }, [employeeId]);

  // 1. Lease-based Leader Election
  useEffect(() => {
    if (!employeeId) return;

    let leaseTimeoutId: NodeJS.Timeout | null = null;
    const tabId = tabIdRef.current;

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

        // Read back to prevent race condition write clashes
        const checkAcquired = localStorage.getItem(LEASE_KEY);
        try {
          const parsed = checkAcquired ? JSON.parse(checkAcquired) : null;
          if (parsed && parsed.tabId === tabId) {
            if (!isLeaderRef.current) {
              isLeaderRef.current = true;
              setIsLeader(true);
              console.log(`[AttendanceTracker] Tab ${tabId} acquired background leadership lease.`);
            }
          } else {
            if (isLeaderRef.current) {
              isLeaderRef.current = false;
              setIsLeader(false);
              console.log(`[AttendanceTracker] Tab ${tabId} lost write race for leadership.`);
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
          console.log(`[AttendanceTracker] Tab ${tabId} stepped down. Leader is ${lease.tabId}`);
        }
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
      } catch (err) {}
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (leaseTimeoutId) clearTimeout(leaseTimeoutId);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [employeeId]);

  // 2. Global Event Listeners to Track Telemetry (mouse, keys, click, scroll)
  useEffect(() => {
    const isClockedIn = record && !record.check_out && record.status !== 'Logged Out';
    if (!employeeId || !isClockedIn || isClockOutPending) return;

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
  }, [employeeId, record, isClockOutPending]);

  // 3. SharedWorker / BroadcastChannel Multi-Tab Inactivity Tracking
  useEffect(() => {
    const isClockedIn = record && !record.check_out && record.status !== 'Logged Out';
    if (!employeeId || !isClockedIn || isClockOutPending) return;

    // Only run idle tracking if currently in Working, Idle, or Break (Auto)
    const currentStatus = record.status;
    if (!['Working', 'Idle', 'Break (Auto)'].includes(currentStatus)) return;

    let worker: SharedWorker | null = null;
    let fallbackBc: BroadcastChannel | null = null;
    let localInterval: any = null;
    let fallbackOnActivity: (() => void) | null = null;
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleStateTransition = async (newState: 'Working' | 'Idle' | 'Break (Auto)') => {
      if (newState !== currentStatus) {
        try {
          const res = await logStatusTransitionEvent(record.id, newState);
          if (res.success) {
            // Notify other tabs to reload states
            const bc = new BroadcastChannel('attendance_tabs');
            bc.postMessage({ type: 'STATE_REFRESH', sessionId: record.id });
            bc.close();
            refreshActiveSession();
          }
        } catch (err) {
          console.error('[AttendanceTracker] State transition fail:', err);
        }
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
      console.warn('[AttendanceTracker] SharedWorker not supported or blocked, running fallback BroadcastChannel:', err);
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
        // 5 minutes (300,000 ms) idle threshold — matches Supabase sweep_active_sessions_telemetry
        if (delta >= 300000 && delta < 420000 && currentStatus === 'Working') {
          await handleStateTransition('Idle');
          if (fallbackBc) fallbackBc.postMessage({ type: 'STATE_CHANGED', state: 'Idle' });
        } 
        // 7 minutes (420,000 ms) auto break threshold — matches Supabase sweep_active_sessions_telemetry
        else if (delta >= 420000 && (currentStatus === 'Working' || currentStatus === 'Idle')) {
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
      fallbackOnActivity = onActivity;
      activityEvents.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    }

    const reportActivity = () => {
      if (worker) worker.port.postMessage({ type: 'ACTIVITY' });
    };

    activityEvents.forEach(ev => window.addEventListener(ev, reportActivity, { passive: true }));

    return () => {
      activityEvents.forEach(ev => window.removeEventListener(ev, reportActivity));
      if (fallbackOnActivity) {
        activityEvents.forEach(ev => window.removeEventListener(ev, fallbackOnActivity!));
      }
      if (worker) worker.port.close();
      if (fallbackBc) fallbackBc.close();
      if (localInterval) clearInterval(localInterval);
    };
  }, [employeeId, record, isClockOutPending]);

  // 4. Periodic Telemetry Heartbeat Loop
  useEffect(() => {
    const isClockedIn = record && !record.check_out && record.status !== 'Logged Out';
    if (!employeeId || !isClockedIn || isClockOutPending) return;

    const isHeartbeatActive = ['Working', 'Approved WFH', 'Break', 'Break (Auto)', 'Idle'].includes(record.status);
    if (!isHeartbeatActive) return;

    const sendHeartbeat = () => {
      if (!navigator.geolocation) return;
      if (!isLeaderRef.current) return; // Only leader tab sends heartbeats

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 10;
          
          const devInfo = getDeviceInfo();
          const payload = {
            sessionId: record.id,
            sequenceNumber: sequenceNumber.current,
            clientTimestamp: new Date().toISOString(),
            idempotencyKey: `hbeat-${record.id}-${sequenceNumber.current}-${Date.now()}`,
            activeWindow: !document.hidden,
            meetingMode: false,
            deviceType: devInfo.deviceType,
            deviceLabel: devInfo.deviceLabel,
            deviceFingerprint: getOrCreateFingerprint(),
            tabId: tabIdRef.current,
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
            // Signal a pulse to active UI tabs
            const bcPulse = new BroadcastChannel('attendance_heartbeat_pulse');
            bcPulse.postMessage({ type: 'HEARTBEAT_PULSE', active: true });
            bcPulse.close();

            const res = await processHeartbeat(payload);
            if (res.success) {
              if (res.status !== record.status) {
                // Status changed dynamically, sync states
                refreshActiveSession();
                const bc = new BroadcastChannel('attendance_tabs');
                bc.postMessage({ type: 'STATE_REFRESH' });
                bc.close();
              }
            } else {
              if (res.error === 'Session active on another device') {
                // Notify page of hijacked session warning
                const bcHijack = new BroadcastChannel('attendance_hijack_warning');
                bcHijack.postMessage({ type: 'HIJACK_WARNING', sessionId: record.id });
                bcHijack.close();
              } else if (res.error?.includes('Session is already clocked out') || res.error?.includes('not found')) {
                refreshActiveSession();
                const bc = new BroadcastChannel('attendance_tabs');
                bc.postMessage({ type: 'STATE_REFRESH' });
                bc.close();
              }
            }
          } catch (err) {
            console.error('[AttendanceTracker] Heartbeat error:', err);
          }
        },
        (error) => {
          console.warn('[AttendanceTracker] Heartbeat GPS warning:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const isBreakOrIdle = ['Break', 'Break (Auto)', 'Idle'].includes(record.status);
    const heartbeatInterval = isBreakOrIdle ? 300000 : 60000;

    const interval = setInterval(sendHeartbeat, heartbeatInterval);
    return () => clearInterval(interval);
  }, [employeeId, record, isClockOutPending]);

  return null; // Background component, no UI
}
