'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, LogIn, LogOut, Loader2, Home, AlertCircle, X, Sparkles, History, Calendar as CalendarIcon, Clock, Info, WifiOff, RefreshCw, AlertTriangle, Coffee, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDistance, getISTShiftDate } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { checkIn, checkOut, resumeSession, requestWFH, startBreak, endBreak, getLateLoginsStats } from './actions';
import { getOrCreateFingerprint } from '@/lib/security/client-fingerprint';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { enqueueOfflineAction } from '@/lib/offline-queue';

const statusColors: Record<string, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  absent: 'bg-red-500/10 text-red-600 border-red-500/20',
  'half-day': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'pending wfh': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'approved wfh': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'rejected wfh': 'bg-red-500/10 text-red-600 border-red-500/20',
  working: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'on break': 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse',
  'logged out': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
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

export default function AttendanceClient({ initialRecords }: { initialRecords: AttendanceRecord[] }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [wfhRequest, setWfhRequest] = useState<{ active: boolean; distance?: number; officeName?: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
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
    if (!todayRecord) return;
    setConfirmAction({
      message: 'Are you sure you want to clock out for today? Any running breaks will be ended automatically.',
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

        try {
          const fingerprint = getOrCreateFingerprint();
          const result = await checkOut(todayRecord.id, lat, lng, undefined, undefined, fingerprint);
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
              'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-semibold',
              !isOnline
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-700'
            )}
          >
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <><WifiOff className="w-4 h-4" /> You are offline. Attendance actions will be saved locally.</>
              ) : (
                <><RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} /> {pendingCount} pending attendance {pendingCount === 1 ? 'action' : 'actions'} to sync.</>
              )}
            </div>
            {isOnline && pendingCount > 0 && (
              <button
                onClick={syncQueue}
                disabled={isSyncing}
                className="px-3 py-1 rounded-lg bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-blue-600 transition-colors disabled:opacity-50"
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
            "p-5 rounded-2xl border flex items-start gap-4 shadow-sm backdrop-blur-md",
            lateStats.lateCount >= 6 ? "bg-red-500/10 border-red-500/25 text-red-800" :
            lateStats.lateCount >= 3 ? "bg-amber-500/10 border-amber-500/25 text-amber-800" :
            "bg-blue-500/10 border-blue-500/20 text-blue-800"
          )}
        >
          <div className={cn(
            "p-3 rounded-xl shrink-0 border",
            lateStats.lateCount >= 6 ? "bg-red-500/10 border-red-500/20 text-red-500" :
            lateStats.lateCount >= 3 ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
            "bg-blue-500/10 border-blue-500/20 text-blue-500"
          )}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-navy-950">Late Login Penalty Status</h4>
            <div className="grid grid-cols-2 gap-4 pt-1 text-xs font-semibold text-navy-900/80">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Lates This Month</span>
                <span className="text-base font-extrabold text-navy-950">{lateStats.lateCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Deductions Applied</span>
                <span className="text-base font-extrabold text-navy-950">{lateStats.deduction} Day</span>
              </div>
            </div>
            <p className="text-[11px] mt-2 font-bold text-navy-900 leading-relaxed border-t border-navy-900/10 pt-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              {lateStats.warningMessage}
            </p>
          </div>
        </motion.div>
      )}

      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-xl bg-navy-900 p-6 text-white shadow-md shadow-navy-900/10">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary-200">Shift & Break Matrix</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Time & Attendance</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium">Night Shift: 06:30 PM to 03:30 AM (9 Hours total)</p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Current Time</p>
            <p className="text-xl font-bold text-white font-mono">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Main Clock-in Control */}
        <Card hover={false} className="p-6 rounded-xl border border-border shadow-sm bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
            <Clock className="w-36 h-36 text-navy-900" />
          </div>

          <div className="flex flex-col items-center justify-center space-y-6 py-2">
            <div className="text-center">
              <p className="text-5xl font-bold text-navy-900 font-mono tracking-tight">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-alt border border-border/40 text-[9px] font-bold text-text-muted uppercase tracking-wider mt-4">
                <CalendarIcon className="w-3 h-3" />
                {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {checkedIn && !isCheckedOut && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[240px] p-4 rounded-xl bg-gradient-to-br from-navy-900 to-navy-950 text-white shadow-md text-center relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-white/5 rounded-full blur-xl" />
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-90 mb-1 flex items-center justify-center gap-1">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    currentStatus === 'On Break' ? "bg-amber-400 animate-ping" : "bg-emerald-400 animate-pulse"
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
                  className="w-full py-3.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-semibold shadow active:scale-95 transition-all text-sm group"
                  onClick={handleCheckIn} 
                  disabled={gpsStatus === 'loading'}
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Locating...</>
                  ) : (
                    <><LogIn className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" /> Clock In</>
                  )}
                </Button>
              ) : !isCheckedOut ? (
                <Button 
                  size="md" 
                  className="w-full py-3.5 rounded-lg bg-white border border-red-500 text-red-500 hover:bg-red-50 font-semibold active:scale-95 transition-all text-sm group"
                  onClick={handleCheckOut} 
                  disabled={gpsStatus === 'loading'}
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Clocking out...</>
                  ) : (
                    <><LogOut className="w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" /> Clock Out</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-navy-900 uppercase tracking-tight">Clock Out Complete</p>
                    <p className="text-[10px] text-text-muted mt-0.5 font-medium">Your attendance has been recorded successfully.</p>
                  </div>
                  <button 
                    onClick={handleResume} 
                    className="text-[9px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider cursor-pointer"
                  >
                    Undo Clock Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Break and Shift Monitoring Widgets */}
        {checkedIn && !isCheckedOut ? (
          <Card hover={false} className="p-6 rounded-xl border border-border shadow-sm bg-white overflow-hidden relative flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Coffee className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900 text-sm tracking-tight">Break Control Room</h3>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">1 hour daily permitted limit</p>
                </div>
              </div>

              {/* Break Overrun Warning System */}
              {breakUsedSeconds >= 60 * 60 ? (
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-700 flex items-center gap-2.5 text-xs font-bold"
                >
                  <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
                  <span>Break Limit Exceeded! Please return to work immediately.</span>
                </motion.div>
              ) : breakUsedSeconds >= 45 * 60 ? (
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 flex items-center gap-2.5 text-xs font-bold">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                  <span>Approaching Allowed Break Limit (45m+ used).</span>
                </div>
              ) : null}

              {/* Timers Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 bg-surface-alt border border-border/50 text-center">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Productive Work</span>
                  <span className="font-mono text-base font-extrabold text-navy-900">{formatSeconds(productiveSeconds)}</span>
                </div>
                <div className={cn(
                  "rounded-xl p-3 border text-center",
                  breakUsedSeconds >= 3600 ? "bg-red-500/5 border-red-500/20" : "bg-surface-alt border-border/50"
                )}>
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Break Used</span>
                  <span className={cn(
                    "font-mono text-base font-extrabold",
                    breakUsedSeconds >= 3600 ? "text-red-500" :
                    breakUsedSeconds >= 2700 ? "text-amber-500" : "text-navy-900"
                  )}>{formatSeconds(breakUsedSeconds)}</span>
                </div>
                <div className="rounded-xl p-3 bg-surface-alt border border-border/50 text-center">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Remaining allowed</span>
                  <span className="font-mono text-base font-extrabold text-navy-900">{formatSeconds(remainingBreakSeconds)}</span>
                </div>
              </div>
            </div>

            {/* Break Control Toggle Buttons */}
            <div className="flex gap-3 pt-5 border-t border-border/40">
              <Button
                variant={currentStatus === 'Working' ? 'primary' : 'outline'}
                disabled={currentStatus !== 'Working' || isBreakActionLoading}
                onClick={handleStartBreak}
                className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wider rounded-lg active:scale-95 transition-all shadow-sm border border-border"
              >
                {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Break'}
              </Button>
              <Button
                variant={currentStatus === 'On Break' ? 'primary' : 'outline'}
                disabled={currentStatus !== 'On Break' || isBreakActionLoading}
                onClick={handleEndBreak}
                className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wider rounded-lg active:scale-95 transition-all shadow-sm border border-border"
              >
                {isBreakActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'End Break'}
              </Button>
            </div>
          </Card>
        ) : (
          /* Temporal Matrix (Calendar) */
          <Card hover={false} className="p-6 rounded-xl border border-white/5 bg-navy-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
              <CalendarIcon className="w-36 h-36 text-white" />
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-base tracking-tight text-white">Monthly Attendance</h2>
              <div className="px-3 py-1 rounded bg-white/10 text-[9px] font-bold uppercase tracking-wider text-primary-300">
                {currentTime.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                <div key={d} className="text-[9px] font-bold text-gray-500 py-1 uppercase tracking-wider">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const status = day ? getStatusForDay(day) : null;
                return (
                  <div key={i} className="aspect-square flex items-center justify-center relative group">
                    {day && (
                      <motion.div 
                        whileHover={{ scale: 1.08 }}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all cursor-default relative z-10",
                          status && calendarColors[status] ? calendarColors[status] : "bg-white/5 text-gray-400 hover:bg-white/10"
                        )}
                      >
                        {day}
                        {day === new Date().getDate() && !status && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary-500 rounded-full border border-navy-900" />
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1">Present</p>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto" />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1">WFH</p>
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mx-auto" />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1">Late</p>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto" />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1">Absent</p>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* History Sequence */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-1 h-5 bg-primary-500 rounded-full" />
          <h2 className="font-semibold text-navy-900 text-lg tracking-tight">Attendance History</h2>
        </div>

        {/* Mobile: Card List Layout */}
        <div className="block md:hidden space-y-2">
          {initialRecords.map(r => (
            <Card key={r.id} hover={false} className="p-4 rounded-xl border border-border/60 shadow-sm bg-white">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-navy-900 tracking-tight text-xs">
                  {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                  statusColors[r.status.toLowerCase()] || 'bg-gray-100'
                )}>
                  {r.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
                  <Clock className="w-3 h-3" />
                  <span>{r.check_in || '--:--'} → {r.check_out || 'Active'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min((r.duration_hours / 9) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-navy-900">{r.duration_hours}h</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop: Full Table Layout */}
        <Card hover={false} className="p-0 overflow-hidden rounded-xl border border-border/80 shadow-sm bg-white hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-surface-alt/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Work Hours</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {initialRecords.map(r => (
                  <tr key={r.id} className="hover:bg-surface-alt/20 transition-all group">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-navy-900 tracking-tight text-xs">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      <p className="text-[9px] text-text-muted font-medium uppercase tracking-wider mt-0.5">{r.check_in || '--:--'} → {r.check_out || 'Clocked In'}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                        statusColors[r.status.toLowerCase()] || 'bg-gray-100'
                      )}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-500 rounded-full" 
                            style={{ width: `${Math.min((r.duration_hours / 9) * 100, 100)}%` }} 
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-navy-900">{r.duration_hours}h</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <History className="w-3.5 h-3.5 text-gray-300 ml-auto group-hover:text-primary-500 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* WFH Request Interface */}
      <AnimatePresence>
        {wfhRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              className="w-full max-w-md"
            >
              <Card hover={false} className="p-6 rounded-xl border border-border shadow-md bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <button 
                    onClick={() => setWfhRequest(null)}
                    className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center text-navy-900 hover:bg-navy-900 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow shadow-primary-500/10 mb-1">
                    <Home className="w-7 h-7" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-navy-900 tracking-tight leading-tight">Work from Home Request?</h3>
                    <div className="mt-3 p-3 rounded-lg bg-surface-alt border border-border/40 text-xs text-text-muted font-medium leading-relaxed">
                      You are currently <span className="font-bold text-navy-900 text-xs">{formatDistance(wfhRequest.distance || 0)}</span> away from the office (<span className="font-bold text-navy-900">{wfhRequest.officeName}</span>).
                      <p className="mt-1.5 italic">You are outside the office range. Would you like to submit a Work From Home (WFH) check-in request instead?</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col w-full gap-2 pt-4">
                    <Button 
                      onClick={handleWFHRequest} 
                      disabled={gpsStatus === 'loading'} 
                      size="sm"
                      className="w-full"
                    >
                      Submit WFH Check-In
                    </Button>
                    <button 
                      onClick={() => setWfhRequest(null)} 
                      className="text-[9px] font-bold text-text-muted uppercase tracking-wider hover:text-navy-900 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-sm"
            >
              <Card hover={false} className="p-5 rounded-xl border border-border shadow-md bg-white relative overflow-hidden">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 tracking-tight">Confirm Action</h3>
                    <p className="text-xs text-text-muted mt-1.5 font-medium leading-relaxed">{confirmAction.message}</p>
                  </div>
                  <div className="flex w-full gap-2 pt-2">
                    <button
                       onClick={() => setConfirmAction(null)}
                      className="flex-1 py-2 px-3 rounded-lg bg-surface-alt hover:bg-border/60 text-navy-900 text-xs font-semibold transition-all cursor-pointer border border-border"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={() => {
                        confirmAction.onConfirm();
                        setConfirmAction(null);
                      }}
                      size="sm"
                      className="flex-1 bg-red-500 hover:bg-red-600 border-red-500"
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              </Card>
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
              "rounded-2xl p-4 shadow-2xl border backdrop-blur-md flex items-start gap-3 bg-white/95",
              notification.type === 'success' ? "border-emerald-500/20 text-emerald-600" :
              notification.type === 'error' ? "border-red-500/20 text-red-600" :
              "border-primary-500/20 text-primary-600"
            )}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              ) : (
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-primary-500" />
              )}
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-wider text-navy-900">
                  {notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Notification'}
                </p>
                <p className="text-[11px] mt-1 text-text-muted font-bold leading-relaxed">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="text-navy-950/40 hover:text-navy-950 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
