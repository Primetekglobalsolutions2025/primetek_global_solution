'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, LogIn, LogOut, Loader2, Home, AlertCircle, X, Sparkles, History, Calendar as CalendarIcon, Clock, Info, WifiOff, RefreshCw, AlertTriangle, Coffee, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDistance, getISTShiftDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { checkIn, checkOut, resumeSession, requestWFH, startBreak, endBreak, getLateLoginsStats } from './actions';
import { getOrCreateFingerprint } from '@/lib/security/client-fingerprint';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { enqueueOfflineAction, getOfflineQueue } from '@/lib/offline-queue';

const statusColors: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  'half-day': 'bg-blue-50 text-blue-700 border-blue-200',
  'pending wfh': 'bg-violet-50 text-violet-750 border-violet-200',
  'approved wfh': 'bg-emerald-50 text-emerald-750 border-emerald-250',
  'rejected wfh': 'bg-red-50 text-red-750 border-red-200',
  working: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'on break': 'bg-primary-50 text-primary-700 border-primary-200 animate-pulse',
  'logged out': 'bg-zinc-50 text-zinc-650 border-zinc-200',
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
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const getTheme = () => {
    if (['approved', 'logged out', 'approved wfh'].includes(s)) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    }
    if (['pending', 'pending wfh', 'working'].includes(s)) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    if (['rejected', 'rejected wfh', 'absent'].includes(s)) {
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
  
  const { isOnline, pendingCount, isSyncing, syncQueue, refreshPendingCount } = useOfflineSync();

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
  const todayRecord = initialRecords.find(r => r.date === currentShiftDate);

  const checkedIn = !!todayRecord;
  const isCheckedOut = todayRecord && (todayRecord.status === 'Logged Out' || todayRecord.check_out);
  const checkInTime = todayRecord && todayRecord.check_in_raw ? new Date(todayRecord.check_in_raw) : null;
  const currentStatus = todayRecord ? todayRecord.status : 'Logged Out';

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
  }, [initialRecords]);

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

      const result = await checkIn(lat, lng, undefined, undefined, fingerprint);
      
      if (!result.success) {
        if (result.outOfRadius) {
          setWfhRequest({ active: true, distance: result.distance, officeName: result.officeName });
          setGpsStatus('idle');
        } else {
          setGpsStatus('error');
          showNotification(result.error || 'Check-in failed', 'error');
        }
        return;
      }

      setGpsStatus('success');
      showNotification('Clocked in successfully.', 'success');
      window.location.reload();
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
      const result = await requestWFH(coords.lat, coords.lng, undefined, undefined, fingerprint);
      if (result.success) {
        setGpsStatus('success');
        setWfhRequest(null);
        showNotification('Work From Home request submitted successfully.', 'success');
        window.location.reload();
      } else {
        showNotification(result.error || 'Failed to request WFH', 'error');
        setGpsStatus('error');
      }
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

        try {
          const result = await checkOut(recordId, lat, lng, undefined, undefined, fingerprint);
          if (result.success) {
            setGpsStatus('success');
            showNotification('Clocked out successfully.', 'success');
            window.location.reload();
          } else {
            showNotification(result.error || 'Check-out failed', 'error');
            setGpsStatus('error');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Check-out failed';
          setGpsStatus('error');
          showNotification(errorMsg, 'error');
        }
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
        try {
          const result = await resumeSession(todayRecord.id);
          if (result.success) {
            setGpsStatus('success');
            showNotification('Clock out undone. Session resumed.', 'success');
            window.location.reload();
          } else {
            showNotification(result.error || 'Failed to resume session', 'error');
            setGpsStatus('error');
          }
        } catch {
          setGpsStatus('error');
          showNotification('Failed to resume session', 'error');
        }
      }
    });
  };

  const handleStartBreak = async () => {
    setIsBreakActionLoading(true);
    try {
      const res = await startBreak();
      if (res.success) {
        showNotification('Break started. Productive timer paused.', 'success');
        window.location.reload();
      } else {
        showNotification(res.error || 'Failed to start break', 'error');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to start break';
      showNotification(errorMsg, 'error');
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setIsBreakActionLoading(true);
    try {
      const res = await endBreak();
      if (res.success) {
        showNotification('Break ended. Productive timer resumed.', 'success');
        window.location.reload();
      } else {
        showNotification(res.error || 'Failed to end break', 'error');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to end break';
      showNotification(errorMsg, 'error');
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

  const monthStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1);
  const daysInMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < monthStart.getDay(); i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getStatusForDay = (day: number) => {
    const dStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = initialRecords.find(r => r.date === dStr);
    return record?.status?.toLowerCase() || null;
  };

  const calendarColors: Record<string, string> = {
    present: 'bg-emerald-500 text-white',
    late: 'bg-amber-500 text-white',
    absent: 'bg-red-500 text-white',
    'half-day': 'bg-blue-500 text-white',
    'pending wfh': 'bg-violet-400 text-white',
    'approved wfh': 'bg-primary-500 text-white',
    'rejected wfh': 'bg-red-400 text-white',
    working: 'bg-emerald-500 text-white',
    'on break': 'bg-amber-500 text-white',
    'logged out': 'bg-gray-500 text-white',
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Offline / Pending Sync Indicator */}
      <AnimatePresence>
        {(!isOnline || pendingCount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-semibold font-sans',
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

      {/* Monthly Late Login Penalty Banner */}
      {lateStats.lateCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-5 rounded-lg border flex items-start gap-4 shadow-2xs bg-white",
            lateStats.lateCount >= 6 ? "border-red-200" :
            lateStats.lateCount >= 3 ? "border-amber-200" : "border-primary-200"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded border flex items-center justify-center shrink-0",
            lateStats.lateCount >= 6 ? "bg-red-50 text-red-500 border-red-200" :
            lateStats.lateCount >= 3 ? "bg-amber-50 text-amber-500 border-amber-200" :
            "bg-primary-50 text-primary-500 border-primary-200"
          )}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Late Login Penalty Status</h4>
            <div className="grid grid-cols-2 gap-4 pt-1 text-xs font-semibold text-navy-900">
              <div>
                <span className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider block">Lates This Month</span>
                <span className="text-xl font-bold text-navy-900 font-sans tracking-tight">{lateStats.lateCount}</span>
              </div>
              <div>
                <span className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider block">Deductions Applied</span>
                <span className="text-xl font-bold text-navy-900 font-sans tracking-tight">{lateStats.deduction} Day</span>
              </div>
            </div>
            <p className="text-[11px] mt-2 font-medium text-zinc-650 leading-relaxed border-t border-zinc-100 pt-2 flex items-center gap-1.5 font-sans">
              <Info className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              {lateStats.warningMessage}
            </p>
          </div>
        </motion.div>
      )}

      {/* Premium Header - Vercel Layout + Brand Navy Background */}
      <div className="relative overflow-hidden rounded-lg bg-navy-900 p-6 text-white shadow-md shadow-navy-900/10">
        <div className="absolute top-[-25%] right-[-15%] w-[40%] h-[120%] bg-primary-500/15 rounded-full blur-[80px] animate-pulse" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] font-medium uppercase tracking-wider text-primary-200">
              <span>Shift & Break Matrix</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Time & Attendance</h1>
            <p className="text-zinc-400 text-xs mt-1 font-medium font-sans">Night Shift: 06:30 PM to 03:30 AM (9 Hours total)</p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Current Time</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Main Clock-in Control */}
        <div className="bg-white rounded-lg p-6 border border-zinc-200/80 shadow-2xs overflow-hidden relative flex flex-col justify-center min-h-[300px]">
          <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
            <Clock className="w-36 h-36 text-navy-900" />
          </div>

          <div className="flex flex-col items-center justify-center space-y-6 py-2">
            <div className="text-center">
              <p className="text-4xl font-bold text-navy-900 font-mono tracking-tight">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-50 border border-zinc-200/80 text-[9px] font-mono font-semibold text-zinc-450 uppercase tracking-wider mt-4">
                <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {checkedIn && !isCheckedOut && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[240px] p-4 rounded-lg bg-navy-900 text-white shadow-sm text-center relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-white/5 rounded-full blur-xl" />
                <p className="text-[9px] font-mono font-medium uppercase tracking-wider opacity-90 mb-1.5 flex items-center justify-center gap-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    currentStatus === 'On Break' ? "bg-amber-400 animate-ping" : "bg-primary-400 animate-pulse"
                  )} />
                  Status: {currentStatus}
                </p>
                <p className="text-2xl font-bold font-mono tracking-tight">
                  {String(elapsedHrs).padStart(2, '0')}:{String(elapsedMin).padStart(2, '0')}:{String(elapsedSec).padStart(2, '0')}
                </p>
              </motion.div>
            )}

            <div className="w-full max-w-[280px]">
              {!checkedIn ? (
                <Button 
                  size="md" 
                  className="w-full py-2.5 rounded-md bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold shadow active:scale-95 transition-all font-sans flex items-center justify-center gap-2 group"
                  onClick={handleCheckIn} 
                  disabled={gpsStatus === 'loading'}
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locating...</>
                  ) : (
                    <><LogIn className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Clock In</>
                  )}
                </Button>
              ) : !isCheckedOut ? (
                <Button 
                  size="md" 
                  className="w-full py-2.5 rounded-md bg-white border border-red-500 text-red-650 hover:bg-red-50/50 text-xs font-semibold active:scale-95 transition-all font-sans flex items-center justify-center gap-2 group"
                  onClick={handleCheckOut} 
                  disabled={gpsStatus === 'loading'}
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Clocking out...</>
                  ) : (
                    <><LogOut className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-red-500" /> Clock Out</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 font-sans">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-navy-900 uppercase tracking-tight">Clock Out Complete</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">Your attendance has been recorded successfully.</p>
                  </div>
                  <button 
                    onClick={handleResume} 
                    className="text-[9px] font-mono font-semibold text-primary-700 hover:text-primary-850 uppercase tracking-wider cursor-pointer"
                  >
                    Undo Clock Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Break and Shift Monitoring Widgets */}
        {checkedIn && !isCheckedOut ? (
          <div className="bg-white rounded-lg p-6 border border-zinc-200/80 shadow-2xs overflow-hidden relative flex flex-col justify-between min-h-[300px]">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-500">
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
                  className="p-3 rounded border border-red-200 bg-red-50 text-red-700 flex items-center gap-2 text-xs font-semibold font-sans"
                >
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-red-500" />
                  <span>Break Limit Exceeded! Please return to work immediately.</span>
                </motion.div>
              ) : breakUsedSeconds >= 45 * 60 ? (
                <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-2 text-xs font-semibold font-sans">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                  <span>Approaching Allowed Break Limit (45m+ used).</span>
                </div>
              ) : null}

              {/* Timers Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded bg-zinc-50 border border-zinc-150 p-3 text-center">
                  <span className="text-[8px] font-mono font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Productive Work</span>
                  <span className="font-mono text-base font-bold text-navy-900">{formatSeconds(productiveSeconds)}</span>
                </div>
                <div className={cn(
                  "rounded p-3 border text-center",
                  breakUsedSeconds >= 3600 ? "bg-red-50 border-red-150" : "bg-zinc-50 border-zinc-150"
                )}>
                  <span className="text-[8px] font-mono font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Break Used</span>
                  <span className={cn(
                    "font-mono text-base font-bold",
                    breakUsedSeconds >= 3600 ? "text-red-650" :
                    breakUsedSeconds >= 2700 ? "text-amber-600" : "text-navy-900"
                  )}>{formatSeconds(breakUsedSeconds)}</span>
                </div>
                <div className="rounded bg-zinc-50 border border-zinc-150 p-3 text-center">
                  <span className="text-[8px] font-mono font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Remaining Allowed</span>
                  <span className="font-mono text-base font-bold text-navy-900">{formatSeconds(remainingBreakSeconds)}</span>
                </div>
              </div>
            </div>

            {/* Break Control Toggle Buttons */}
            <div className="flex gap-3 pt-5 border-t border-zinc-150">
              <Button
                variant={(currentStatus === 'Working' || currentStatus === 'Approved WFH') ? 'primary' : 'outline'}
                disabled={(currentStatus !== 'Working' && currentStatus !== 'Approved WFH') || isBreakActionLoading}
                onClick={handleStartBreak}
                className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md active:scale-95 transition-all shadow-3xs border border-zinc-200 font-sans"
              >
                {isBreakActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Start Break'}
              </Button>
              <Button
                variant={currentStatus === 'On Break' ? 'primary' : 'outline'}
                disabled={currentStatus !== 'On Break' || isBreakActionLoading}
                onClick={handleEndBreak}
                className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md active:scale-95 transition-all shadow-3xs border border-zinc-200 font-sans"
              >
                {isBreakActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'End Break'}
              </Button>
            </div>
          </div>
        ) : (
          /* Temporal Matrix (Calendar) */
          <div className="bg-navy-900 rounded-lg p-6 border border-white/5 text-white overflow-hidden relative flex flex-col justify-between min-h-[300px]">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
              <CalendarIcon className="w-36 h-36 text-white" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-sm tracking-tight text-white font-sans">Monthly Attendance</h2>
                <div className="px-2.5 py-1 rounded bg-white/10 text-[9px] font-mono font-medium uppercase tracking-wider text-primary-300">
                  {currentTime.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                  <div key={d} className="text-[9px] font-mono font-semibold text-zinc-500 py-1 uppercase tracking-wider">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const status = day ? getStatusForDay(day) : null;
                  return (
                    <div key={i} className="aspect-square flex items-center justify-center relative">
                      {day && (
                        <motion.div 
                          whileHover={{ scale: 1.05 }}
                          className={cn(
                            "w-7 h-7 rounded flex items-center justify-center text-[11px] font-semibold transition-all cursor-default relative z-10 font-sans",
                            status && calendarColors[status] ? calendarColors[status] : "bg-white/5 text-zinc-400 hover:bg-white/10"
                          )}
                        >
                          {day}
                          {day === new Date().getDate() && !status && (
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary-500 rounded-full border border-navy-900" />
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-4 gap-2 text-[8px] font-mono uppercase tracking-wider text-zinc-400 text-center">
              <div>
                <p className="mb-1">Present</p>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto" />
              </div>
              <div>
                <p className="mb-1">WFH</p>
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mx-auto" />
              </div>
              <div>
                <p className="mb-1">Late</p>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto" />
              </div>
              <div>
                <p className="mb-1">Absent</p>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto" />
              </div>
            </div>
          </div>
        )}
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
            <div key={r.id} className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs font-sans">
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
            </div>
          ))}
        </div>

        {/* Desktop: Full Table Layout */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white hidden md:block shadow-2xs">
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
                      <History className="w-3.5 h-3.5 text-zinc-300 ml-auto group-hover:text-primary-500 transition-colors" />
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
              <div className="bg-white rounded-lg p-6 border border-zinc-200 shadow-xl relative overflow-hidden font-sans">
                <div className="absolute top-0 right-0 p-4">
                  <button 
                    onClick={() => setWfhRequest(null)}
                    className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-650 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded border border-primary-200 bg-primary-50 text-primary-500 flex items-center justify-center shadow-3xs mb-1">
                    <Home className="w-6 h-6" />
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight leading-tight">Work from Home Request?</h3>
                    <div className="mt-3 p-3 rounded bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 font-medium leading-relaxed">
                      You are currently <span className="font-bold text-navy-900 text-xs">{formatDistance(wfhRequest.distance || 0)}</span> away from the office (<span className="font-bold text-navy-900">{wfhRequest.officeName}</span>).
                      <p className="mt-1.5 italic">You are outside the office range. Would you like to submit a Work From Home (WFH) check-in request instead?</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col w-full gap-2 pt-4">
                    <Button 
                      onClick={handleWFHRequest} 
                      disabled={gpsStatus === 'loading'} 
                      size="sm"
                      className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-xs font-semibold"
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
              <div className="bg-white rounded-lg p-5 border border-zinc-200 shadow-xl relative overflow-hidden font-sans">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={cn(
                    "w-12 h-12 rounded border flex items-center justify-center",
                    confirmAction.variant === 'danger' ? "bg-red-50 border-red-200 text-red-500" : "bg-primary-50 border-primary-200 text-primary-500"
                  )}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight">Confirm Action</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 font-medium leading-relaxed">{confirmAction.message}</p>
                  </div>
                  <div className="flex w-full gap-2 pt-2">
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 py-2 px-3 rounded-md bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition-all cursor-pointer border border-zinc-200"
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
                        "flex-1 border rounded-md py-2 text-xs font-semibold shadow-3xs",
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
              "rounded-lg p-4 shadow-xl border backdrop-blur-md flex items-start gap-3 bg-white/95 border-zinc-200 font-sans",
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
