'use client';

import { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, LogIn, LogOut, Loader2, Home, AlertCircle, X, Sparkles, Navigation, History, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { checkIn, checkOut, resumeSession, requestWFH } from './actions';

const statusColors: Record<string, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  absent: 'bg-red-500/10 text-red-600 border-red-500/20',
  'half-day': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'pending wfh': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'approved wfh': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'rejected wfh': 'bg-red-500/10 text-red-600 border-red-500/20',
};

export interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_raw: string | null;
  duration_hours: number;
  status: string;
}

export default function AttendanceClient({ initialRecords }: { initialRecords: AttendanceRecord[] }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [wfhRequest, setWfhRequest] = useState<{ active: boolean; distance?: number; officeName?: string } | null>(null);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const todayStr = getLocalDateString(new Date());
  const todayRecord = initialRecords.find(r => r.date === todayStr);

  const checkedIn = !!todayRecord;
  const isCheckedOut = todayRecord && todayRecord.check_out;
  const checkInTime = todayRecord && todayRecord.check_in_raw ? new Date(todayRecord.check_in_raw) : null;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      
      const result = await checkIn(lat, lng);
      
      if (!result.success) {
        if (result.outOfRadius) {
          setWfhRequest({ active: true, distance: result.distance, officeName: result.officeName });
          setGpsStatus('idle');
        } else {
          setGpsStatus('error');
          alert(result.error || 'Check-in failed');
        }
        return;
      }

      setGpsStatus('success');
    } catch (err: any) {
      setGpsStatus('error');
      alert(err.message || 'Could not get location');
    }
  };

  const handleWFHRequest = async () => {
    if (!coords) return;
    setGpsStatus('loading');
    try {
      const result = await requestWFH(coords.lat, coords.lng);
      if (result.success) {
        setGpsStatus('success');
        setWfhRequest(null);
      } else {
        alert(result.error);
        setGpsStatus('error');
      }
    } catch {
      setGpsStatus('error');
      alert('Failed to request WFH');
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    if (!window.confirm('Clock out now?')) return;
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, 
          timeout: 5000 
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch (gpsErr) {
      console.warn('GPS failed for checkout, proceeding without location:', gpsErr);
    }

    try {
      const result = await checkOut(todayRecord.id, lat || 0, lng || 0);
      if (result.success) {
        setGpsStatus('success');
      } else {
        alert(result.error);
        setGpsStatus('error');
      }
    } catch (err: any) {
      setGpsStatus('error');
      alert(err.message || 'Check-out failed');
    }
  };

  const handleResume = async () => {
    if (!todayRecord) return;
    setGpsStatus('loading');
    try {
      const result = await resumeSession(todayRecord.id);
      if (result.success) setGpsStatus('success');
      else {
        alert(result.error);
        setGpsStatus('error');
      }
    } catch {
      setGpsStatus('error');
      alert('Failed to resume');
    }
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
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-navy-900 p-8 text-white shadow-xl shadow-navy-900/10">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-200">Attendance Status</span>
            </div>
            <h1 className="text-3xl font-heading font-black tracking-tight text-white">Time & Attendance</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium italic">Clock in and clock out to record your daily working hours.</p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Current Time</p>
            <p className="text-2xl font-black text-white font-mono">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Clock-in Control */}
        <Card hover={false} className="p-10 rounded-[2.5rem] border-border/60 shadow-sm bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <Clock className="w-48 h-48 text-navy-900" />
          </div>

          <div className="flex flex-col items-center justify-center space-y-10 py-4">
            <div className="text-center">
              <p className="text-6xl md:text-7xl font-black text-navy-900 font-mono tracking-tighter drop-shadow-sm">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-alt border border-border/40 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-6">
                <CalendarIcon className="w-3 h-3" />
                {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {checkedIn && !isCheckedOut && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xs p-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-2xl shadow-emerald-500/20 text-center relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Logged In For</p>
                <p className="text-4xl font-black font-mono tracking-tight">
                  {String(elapsedHrs).padStart(2, '0')}:{String(elapsedMin).padStart(2, '0')}:{String(elapsedSec).padStart(2, '0')}
                </p>
              </motion.div>
            )}

            <div className="w-full max-w-sm">
              {!checkedIn ? (
                <Button 
                  size="lg" 
                  className="w-full py-8 rounded-[2rem] bg-navy-900 hover:bg-navy-800 text-white font-black shadow-2xl shadow-navy-900/10 active:scale-95 transition-all text-lg group"
                  onClick={handleCheckIn} 
                  disabled={gpsStatus === 'loading'}
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Getting location...</>
                  ) : (
                    <><LogIn className="w-6 h-6 mr-3 group-hover:-translate-x-1 transition-transform" /> Clock In</>
                  )}
                </Button>
              ) : !isCheckedOut ? (
                <Button 
                  size="lg" 
                  className="w-full py-8 rounded-[2rem] bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 font-black active:scale-95 transition-all text-lg group"
                  onClick={handleCheckOut} 
                  disabled={gpsStatus === 'loading'}
                >
                  {gpsStatus === 'loading' ? (
                    <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Clocking out...</>
                  ) : (
                    <><LogOut className="w-6 h-6 mr-3 group-hover:translate-x-1 transition-transform" /> Clock Out</>
                  )}
                </Button>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-sm font-black text-navy-900 uppercase tracking-tight">Clock Out Complete</p>
                    <p className="text-[10px] text-text-muted mt-1 font-bold">Your attendance has been recorded successfully.</p>
                  </div>
                  <button 
                    onClick={handleResume} 
                    className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest"
                  >
                    Undo Clock Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Temporal Matrix (Calendar) */}
        <Card hover={false} className="p-10 rounded-[2.5rem] border-border/60 shadow-sm bg-navy-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none">
            <CalendarIcon className="w-48 h-48 text-white" />
          </div>
          
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading font-black text-xl tracking-tight text-white">Monthly Attendance</h2>
            <div className="px-4 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest text-primary-300">
              {currentTime.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <div key={d} className="text-[10px] font-black text-gray-500 py-2 uppercase tracking-widest">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              const status = day ? getStatusForDay(day) : null;
              return (
                <div key={i} className="aspect-square flex items-center justify-center relative group">
                  {day && (
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all cursor-default relative z-10",
                        status && calendarColors[status] ? calendarColors[status] : "bg-white/5 text-gray-400 hover:bg-white/10"
                      )}
                    >
                      {day}
                      {day === new Date().getDate() && !status && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-navy-900" />
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-tighter mb-1">Present</p>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto" />
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-tighter mb-1">WFH</p>
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mx-auto" />
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-tighter mb-1">Late</p>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto" />
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-tighter mb-1">Absent</p>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto" />
            </div>
          </div>
        </Card>
      </div>

      {/* History Sequence */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-4">
          <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
          <h2 className="font-heading font-black text-navy-900 text-2xl tracking-tight">Attendance History</h2>
        </div>

        <Card hover={false} className="p-0 overflow-hidden rounded-[2.5rem] border-border/60 shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-surface-alt/50 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Work Hours</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {initialRecords.map(r => (
                  <tr key={r.id} className="hover:bg-surface-alt/20 transition-all group">
                    <td className="px-8 py-6">
                      <p className="font-black text-navy-900 tracking-tight">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">{r.check_in || '--:--'} → {r.check_out || 'Clocked In'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        statusColors[r.status.toLowerCase()] || 'bg-gray-100'
                      )}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-surface-alt rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-500 rounded-full" 
                            style={{ width: `${Math.min((r.duration_hours / 9) * 100, 100)}%` }} 
                          />
                        </div>
                        <span className="text-xs font-black text-navy-900">{r.duration_hours}h</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <History className="w-4 h-4 text-gray-300 ml-auto group-hover:text-primary-500 transition-colors" />
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
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="w-full max-w-md"
            >
              <Card hover={false} className="p-10 rounded-[3rem] border-0 shadow-2xl bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                  <button 
                    onClick={() => setWfhRequest(null)}
                    className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center text-navy-900 hover:bg-navy-900 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-primary-500 text-white flex items-center justify-center shadow-2xl shadow-primary-500/20 mb-2">
                    <Home className="w-10 h-10" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-heading font-black text-navy-900 tracking-tight leading-tight">Work from Home<br />Request?</h3>
                    <div className="mt-6 p-4 rounded-2xl bg-surface-alt border border-border/40 text-xs text-text-muted font-medium leading-relaxed">
                      You are currently <span className="font-black text-navy-900 text-sm">{(wfhRequest.distance || 0).toLocaleString()}m</span> away from the office (<span className="font-black text-navy-900">{wfhRequest.officeName}</span>).
                      <p className="mt-2 italic">You are outside the office range. Would you like to submit a Work From Home (WFH) check-in request instead?</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col w-full gap-4 pt-6">
                    <Button 
                      onClick={handleWFHRequest} 
                      disabled={gpsStatus === 'loading'} 
                      className="w-full py-6 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-black shadow-xl shadow-primary-500/20 transition-all text-sm"
                    >
                      Submit WFH Check-In
                    </Button>
                    <button 
                      onClick={() => setWfhRequest(null)} 
                      className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] hover:text-navy-900 transition-colors"
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
    </div>
  );
}
