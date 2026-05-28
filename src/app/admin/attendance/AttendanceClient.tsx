'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Download, FileSpreadsheet, Loader2, User, Clock, Calendar, MapPin, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { exportAttendanceExcel, toggleExemption, getSessionEvents, reverseAutoBreak, correctClockOutTime, rebuildSessionProjection, overrideDeviceValidation } from './actions';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  duration_hours: number;
  status: string;
  lat: number;
  lng: number;
  risk_level?: 'low' | 'medium' | 'high';
  risk_score?: number;
  risk_reasons?: { signal: string; weight: number; detail: string }[];
  // Break monitoring
  current_break_start?: string | null;
  total_break_seconds?: number;
  productive_hours?: number;
  // Late login penalty
  is_late?: boolean;
  late_minutes?: number;
  deduction_applied?: number;
  // Exemptions
  late_approved?: boolean;
  permission_approved?: boolean;
  shift_override?: boolean;
  manager_exemption?: boolean;
  check_in_raw?: string | null;
  check_out_raw?: string | null;
  device_type?: string | null;
  device_label?: string | null;
  awaiting_desktop_deadline?: string | null;
}

const statusColors: Record<string, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  absent: 'bg-red-500/10 text-red-600 border-red-500/20',
  'half-day': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'pending wfh': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'approved wfh': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  'rejected wfh': 'bg-red-500/10 text-red-700 border-red-500/30',
  working: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'on break': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'logged out': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  mobile_clocked_in: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  awaiting_desktop: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
  desktop_active: 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25',
  productive_timer_paused: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function AttendanceClient({
  initialAttendance,
  employees
}: {
  initialAttendance: AttendanceRecord[],
  employees: { id: string, name: string }[]
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'logs' | 'live' | 'lates'>('logs');
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [ticks, setTicks] = useState(0);
  const { toast } = useToast();

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedRecordEvents, setSelectedRecordEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Override action state
  const [overrideActionType, setOverrideActionType] = useState<'reverse_autobreak' | 'correct_clockout' | 'rebuild' | 'override_validation' | null>(null);
  const [validationOverrideType, setValidationOverrideType] = useState<'approve_mobile' | 'resume_timer' | 'field_work'>('approve_mobile');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [clockOutTimeCorrection, setClockOutTimeCorrection] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const handleOpenDrawer = async (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
    setIsLoadingEvents(true);
    setOverrideActionType(null);
    setOverrideJustification('');
    setClockOutTimeCorrection('');
    
    // Set a default clock out time if they correct it (e.g. current check out or check in + 9 hours)
    if (record.check_out_raw) {
      // Convert to local datetime-local format for input
      const localDate = new Date(record.check_out_raw);
      // adjust for timezone offset
      const tzOffset = localDate.getTimezoneOffset() * 60000;
      const formatted = new Date(localDate.getTime() - tzOffset).toISOString().slice(0, 16);
      setClockOutTimeCorrection(formatted);
    } else if (record.check_in_raw) {
      const localDate = new Date(record.check_in_raw);
      localDate.setHours(localDate.getHours() + 9); // default 9 hours later
      const tzOffset = localDate.getTimezoneOffset() * 60000;
      const formatted = new Date(localDate.getTime() - tzOffset).toISOString().slice(0, 16);
      setClockOutTimeCorrection(formatted);
    }

    try {
      const events = await getSessionEvents(record.id);
      setSelectedRecordEvents(events);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load session events timeline.');
      setSelectedRecordEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!overrideActionType) return;
    
    if (overrideActionType !== 'rebuild' && (!overrideJustification || overrideJustification.trim() === '')) {
      toast.error('A justification reason is required for overrides.');
      return;
    }

    setIsSubmittingOverride(true);
    try {
      if (overrideActionType === 'rebuild') {
        await rebuildSessionProjection(selectedRecord.id);
        toast.success('Session projection successfully rebuilt.');
      } else if (overrideActionType === 'reverse_autobreak') {
        await reverseAutoBreak(selectedRecord.id, overrideJustification);
        toast.success('Auto-break successfully reversed.');
      } else if (overrideActionType === 'correct_clockout') {
        const utcTimestamp = new Date(clockOutTimeCorrection).toISOString();
        await correctClockOutTime(selectedRecord.id, utcTimestamp, overrideJustification);
        toast.success('Clock-out time adjusted successfully.');
      } else if (overrideActionType === 'override_validation') {
        await overrideDeviceValidation(selectedRecord.id, validationOverrideType, overrideJustification);
        toast.success('Device validation override applied successfully.');
      }
      
      // Refresh events and close action form
      const updatedEvents = await getSessionEvents(selectedRecord.id);
      setSelectedRecordEvents(updatedEvents);
      setOverrideActionType(null);
      setOverrideJustification('');
      
      // Refresh parent table state by updating the page/router
      router.refresh();
      
      // Wait a moment and then update selected record local fields if possible, or just close and refresh
      toast.success('Audit ledger updated.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Action failed.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  const handleDateChange = (start: string, end: string) => {
    const params = new URLSearchParams(window.location.search);
    if (start) params.set('startDate', start);
    else params.delete('startDate');
    if (end) params.set('endDate', end);
    else params.delete('endDate');
    router.push(`/admin/attendance?${params.toString()}`);
  };

  // Tick timer to update live monitors
  useEffect(() => {
    const timer = setInterval(() => {
      setTicks((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayISTStr = useMemo(() => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return ist.toISOString().split('T')[0];
  }, [ticks]); // Re-calculate dynamically on tick

  const filtered = useMemo(() => {
    return initialAttendance.filter((r) => {
      const matchesSearch = !search || (r.employee_name || '').toLowerCase().includes(search.toLowerCase());
      const matchesEmployee = employeeFilter === 'all' || r.employee_id === employeeFilter;
      const matchesStatus = statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesRisk = riskFilter === 'all' || (r.risk_level || 'low').toLowerCase() === riskFilter.toLowerCase();
      return matchesSearch && matchesEmployee && matchesStatus && matchesRisk;
    });
  }, [initialAttendance, search, employeeFilter, statusFilter, riskFilter]);

  // Live Records filter for today or active sessions
  const liveRecords = useMemo(() => {
    return initialAttendance.filter((r) => {
      const isToday = r.date === todayISTStr;
      const isActive = r.status === 'Working' || r.status === 'On Break';
      return isToday || isActive;
    });
  }, [initialAttendance, todayISTStr]);

  // Late Logins filter
  const lateRecords = useMemo(() => {
    return initialAttendance.filter((r) => r.is_late);
  }, [initialAttendance]);

  const employeeLatesTrend = useMemo(() => {
    const counts: Record<string, { total: number; unexempted: number; employee_name: string }> = {};
    lateRecords.forEach((r) => {
      const isUnexempted = !r.late_approved && !r.permission_approved && !r.shift_override && !r.manager_exemption && r.status !== 'Approved WFH';
      if (!counts[r.employee_id]) {
        counts[r.employee_id] = { total: 0, unexempted: 0, employee_name: r.employee_name };
      }
      counts[r.employee_id].total += 1;
      if (isUnexempted) {
        counts[r.employee_id].unexempted += 1;
      }
    });
    return Object.values(counts).sort((a, b) => b.total - a.total);
  }, [lateRecords]);

  const formatDuration = (seconds: number) => {
    if (seconds < 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const handleToggleExemption = async (recordId: string, fieldName: string, currentVal: boolean) => {
    const key = `${recordId}-${fieldName}`;
    setLoadingRows((prev) => ({ ...prev, [key]: true }));
    try {
      await toggleExemption(recordId, fieldName, !currentVal);
      toast.success('Exemption status updated successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update exemption.');
    } finally {
      setLoadingRows((prev) => ({ ...prev, [key]: false }));
    }
  };

  const exportCsv = () => {
    const headers = 'Employee,Date,Check In,Check Out,Hours,Status,Latitude,Longitude';
    const rows = filtered.map((r) =>
      `"${r.employee_name}","${r.date}","${r.check_in || ''}","${r.check_out || ''}",${r.duration_hours},"${r.status}",${r.lat},${r.lng}`
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `primetek-attendance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    try {
      setIsExporting(true);
      const year = new Date().getFullYear();
      toast.success('Excel export started.');
      const res = await exportAttendanceExcel(year);
      
      if (res && res.url) {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = `Primetek_Attendance_${year}_Master.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Excel file generated successfully.');
      } else {
        throw new Error('No URL returned from server');
      }
    } catch (error) {
      console.error('Failed to export Excel:', error);
      toast.error('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs Selection */}
      <div className="flex p-1 bg-white backdrop-blur-md rounded-2xl md:rounded-[2rem] w-full md:w-fit border border-zinc-200 shadow-sm overflow-x-auto scrollbar-none flex-nowrap">
        {[
          { id: 'logs', label: 'Attendance Logs', icon: Calendar },
          { id: 'live', label: 'Live Monitor', icon: Clock },
          { id: 'lates', label: 'Late Login Reports', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.5rem] text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.2em] transition-all duration-300 whitespace-nowrap shrink-0 flex-1 md:flex-initial",
                isActive
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20 scale-[1.02]"
                  : "text-zinc-500 hover:text-navy-900 hover:bg-zinc-50"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4", isActive ? "text-white" : "text-zinc-500")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters & Actions (Sticky Layout Header) */}
          <div className="sticky top-0 z-20 bg-zinc-50/80 backdrop-blur-md py-3 -mx-4 px-4 border-b border-zinc-200/40 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none md:border-b-0 md:py-0 md:relative">
            <div className="flex flex-1 flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Filter by name..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all shadow-sm font-medium" 
                />
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2 items-center">
                <select 
                  value={employeeFilter} 
                  onChange={(e) => setEmployeeFilter(e.target.value)} 
                  className="pl-3 pr-8 py-2 rounded-lg border border-zinc-200 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer shadow-sm min-w-0 sm:min-w-[130px] appearance-none"
                >
                  <option value="all">Personnel: ALL</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
                </select>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="pl-3 pr-8 py-2 rounded-lg border border-zinc-200 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer shadow-sm min-w-0 sm:min-w-[130px] appearance-none"
                >
                  <option value="all">Status: ALL</option>
                  <option value="Present">PRESENT</option>
                  <option value="Late">LATE</option>
                  <option value="Absent">ABSENT</option>
                  <option value="Pending WFH">WFH PENDING</option>
                  <option value="Approved WFH">WFH APPROVED</option>
                  <option value="Working">WORKING</option>
                  <option value="On Break">ON BREAK</option>
                  <option value="Logged Out">LOGGED OUT</option>
                  <option value="MOBILE_CLOCKED_IN">MOBILE CLOCKED IN</option>
                  <option value="AWAITING_DESKTOP">AWAITING DESKTOP</option>
                  <option value="DESKTOP_ACTIVE">DESKTOP ACTIVE</option>
                  <option value="PRODUCTIVE_TIMER_PAUSED">TIMER PAUSED</option>
                </select>
                <select 
                  value={riskFilter} 
                  onChange={(e) => setRiskFilter(e.target.value)} 
                  className="pl-3 pr-8 py-2 rounded-lg border border-zinc-200 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer shadow-sm min-w-0 sm:min-w-[130px] appearance-none col-span-2 sm:col-span-1"
                >
                  <option value="all">Trust: ALL</option>
                  <option value="low">Trust: LOW RISK</option>
                  <option value="medium">Trust: MEDIUM RISK</option>
                  <option value="high">Trust: HIGH RISK</option>
                </select>
                <div className="grid grid-cols-9 items-center gap-1 col-span-2 sm:flex sm:col-span-1 sm:gap-1.5 w-full sm:w-auto">
                  <input
                    type="date"
                    value={startDate}
                    max={todayISTStr}
                    onChange={(e) => handleDateChange(e.target.value, endDate)}
                    className="col-span-4 px-2 py-2 rounded-lg border border-zinc-200 bg-white text-[10px] font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer shadow-sm w-full sm:w-[110px]"
                    placeholder="Start Date"
                  />
                  <span className="col-span-1 text-[10px] text-zinc-400 font-bold text-center">TO</span>
                  <input
                    type="date"
                    value={endDate}
                    max={todayISTStr}
                    onChange={(e) => handleDateChange(startDate, e.target.value)}
                    className="col-span-4 px-2 py-2 rounded-lg border border-zinc-200 bg-white text-[10px] font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer shadow-sm w-full sm:w-[110px]"
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={exportCsv} 
                className="rounded-lg border-zinc-200 font-semibold px-4 py-2 text-xs active:scale-95 transition-all shadow-sm bg-zinc-50/50 text-navy-900 hover:bg-zinc-100"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-zinc-500" /> CSV
              </Button>
              <Button 
                onClick={exportExcel} 
                disabled={isExporting} 
                className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 text-xs active:scale-95 transition-all shadow shadow-teal-500/20"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />}
                Excel Master
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                <span className="text-navy-900 font-extrabold">{filtered.length}</span> entries synchronized
              </p>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-2">
            {filtered.length === 0 ? (
              <Card hover={false} className="p-8 rounded-xl border border-zinc-200 bg-white text-center">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-bold">No logs found.</p>
              </Card>
            ) : (
              filtered.map((record) => (
                <Card 
                  key={record.id} 
                  hover={true} 
                  onClick={() => handleOpenDrawer(record)}
                  className="p-4 rounded-xl border border-zinc-200 bg-white cursor-pointer hover:border-primary-500/40 hover:shadow-md hover:bg-zinc-50 transition-all text-zinc-700"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-zinc-700">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-navy-900 tracking-tight flex items-center gap-1.5">
                        {record.employee_name}
                        <span className="text-[10px]" title={record.device_label || 'Unknown device'}>
                          {record.device_type === 'mobile' || record.device_type === 'tablet' ? '📱' : '💻'}
                        </span>
                      </span>
                    </div>
                    <span className={cn(
                      "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase",
                      statusColors[record.status?.toLowerCase()] || statusColors.present
                    )}>
                      {record.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                    <span>
                      {!isNaN(new Date(record.date).getTime())
                        ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase()
                        : record.date?.toUpperCase() || '—'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{record.check_in || '—'} → {record.check_out || '—'}</span>
                      {record.duration_hours > 0 && (
                        <span className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-[10px] font-bold text-navy-900">
                          {record.duration_hours}H
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200/30">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase",
                        record.risk_level === 'high' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                        record.risk_level === 'medium' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      )}>
                        {record.risk_level || 'low'}
                      </span>
                      {record.risk_score !== undefined && record.risk_score > 0 && (
                        <span className="text-[10px] font-mono text-zinc-400">({record.risk_score} pts)</span>
                      )}
                    </div>
                    <MapPin className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <Card hover={false} className="p-0 overflow-hidden border border-zinc-200 bg-white backdrop-blur-md rounded-xl shadow-sm hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50">
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Staff Member</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Timeline</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clock In</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clock Out</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Intensity</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Compliance</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Trust Engine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-3">
                          <Calendar className="w-5 h-5 text-slate-600" />
                        </div>
                        <p className="text-xs text-zinc-500 font-bold">No synchronization logs found for this period.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((record) => (
                      <tr 
                        key={record.id} 
                        onClick={() => handleOpenDrawer(record)}
                        className="group hover:bg-zinc-50/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-zinc-700 group-hover:bg-primary-500 group-hover:text-navy-900 transition-colors">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold text-navy-900 tracking-tight flex items-center gap-1.5">
                              {record.employee_name}
                              <span className="text-[10px]" title={record.device_label || 'Unknown device'}>
                                {record.device_type === 'mobile' || record.device_type === 'tablet' ? '📱' : '💻'}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="text-[10px] font-semibold text-zinc-500">
                            {!isNaN(new Date(record.date).getTime()) 
                              ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase() 
                              : record.date?.toUpperCase() || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs font-medium text-navy-900">
                            <Clock className="w-3.5 h-3.5 text-emerald-400/50" />
                            {record.check_in || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs font-medium text-navy-900">
                            <Clock className="w-3.5 h-3.5 text-red-400/50" />
                            {record.check_out || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="text-xs font-semibold text-zinc-500">
                            {record.duration_hours > 0 ? (
                              <span className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-[10px] text-navy-900 font-bold">
                                {record.duration_hours}H
                              </span>
                            ) : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className={cn(
                            "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase",
                            statusColors[record.status?.toLowerCase()] || statusColors.present
                          )}>
                            {record.status}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div 
                            className="flex items-center gap-1.5 cursor-help"
                            title={record.risk_reasons && record.risk_reasons.length > 0 
                              ? record.risk_reasons.map((r) => `• ${r.detail} (+${r.weight} pts)`).join('\n') 
                              : 'All trust signals secure (0 pts)'}
                          >
                            <span className={cn(
                              "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase",
                              record.risk_level === 'high' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                              record.risk_level === 'medium' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                              "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}>
                              {record.risk_level || 'low'}
                            </span>
                            {record.risk_score !== undefined && record.risk_score > 0 && (
                              <span className="text-[10px] font-mono text-zinc-400">({record.risk_score} pts)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <span className="text-navy-900 font-extrabold">{liveRecords.length}</span> Active Sessions Today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveRecords.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-zinc-200">
                <Clock className="w-10 h-10 text-slate-650 mx-auto mb-3" />
                <p className="text-xs text-zinc-500 font-bold">No active check-ins detected today.</p>
              </div>
            ) : (
              liveRecords.map((record) => {
                const now = new Date();
                const checkInTime = record.check_in_raw ? new Date(record.check_in_raw) : null;
                const breakStartTime = record.current_break_start ? new Date(record.current_break_start) : null;
                
                const currentStatus = record.status; 
                let totalBreakSecs = record.total_break_seconds || 0;
                
                if (currentStatus === 'On Break' && breakStartTime) {
                  totalBreakSecs += Math.floor((now.getTime() - breakStartTime.getTime()) / 1000);
                }
                
                let totalWorkSecs = 0;
                if (checkInTime) {
                  if (currentStatus === 'Logged Out' && record.check_out_raw) {
                    const checkOutTime = new Date(record.check_out_raw);
                    totalWorkSecs = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 1000);
                  } else {
                    totalWorkSecs = Math.floor((now.getTime() - checkInTime.getTime()) / 1000);
                  }
                }
                
                const productiveSecs = Math.max(0, totalWorkSecs - totalBreakSecs);
                const isOverrun = totalBreakSecs > 3600;
                const isWarning = totalBreakSecs > 2700 && totalBreakSecs <= 3600;

                return (
                  <Card 
                    key={record.id} 
                    hover={false} 
                    className={cn(
                      "p-5 rounded-2xl border bg-white shadow-sm transition-all duration-300 relative overflow-hidden text-navy-900",
                      currentStatus === 'On Break' ? "border-amber-500/30 bg-amber-500/5 animate-pulse" : "border-zinc-200",
                      isOverrun && "ring-2 ring-red-500/50 border-red-500/50 bg-red-500/[0.02]"
                    )}
                  >
                    {isOverrun && (
                      <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] font-black text-center py-1 uppercase tracking-widest">
                        ⚠️ Break Overrun Danger (&gt; 1hr)
                      </div>
                    )}
                    
                    <div className={cn("flex items-start justify-between", isOverrun && "mt-4")}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-zinc-600 font-bold border border-zinc-200/40">
                          {record.employee_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                            {record.employee_name}
                            <span className="text-[10px]" title={record.device_label || 'Unknown device'}>
                              {record.device_type === 'mobile' || record.device_type === 'tablet' ? '📱' : '💻'}
                            </span>
                          </h4>
                          <p className="text-[9px] text-zinc-500 font-bold tracking-widest mt-0.5 font-mono">
                            IN: {record.check_in || '—'}
                          </p>
                        </div>
                      </div>

                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border",
                        currentStatus === 'Working' ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25" :
                        currentStatus === 'On Break' ? "bg-amber-500/10 text-amber-450 border-amber-500/25" :
                        "bg-slate-800/40 text-zinc-500 border-slate-700/50"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          currentStatus === 'Working' ? "bg-emerald-500 animate-pulse" :
                          currentStatus === 'On Break' ? "bg-amber-500 animate-ping" :
                          "bg-slate-500"
                        )} />
                        {currentStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-zinc-200">
                      <div>
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Productive Work</span>
                        <span className="text-xs font-black text-navy-900 font-mono tracking-tight">
                          {formatDuration(productiveSecs)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Break Duration</span>
                        <span className={cn(
                          "text-xs font-black font-mono tracking-tight flex items-center gap-1",
                          isOverrun ? "text-red-500 animate-pulse" :
                          isWarning ? "text-amber-400" :
                          "text-navy-900"
                        )}>
                          {formatDuration(totalBreakSecs)}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'lates' && (
        <div className="space-y-6">
          {/* Lates Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Late Logins', value: lateRecords.length, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
              { label: 'Active Deductions', value: `${lateRecords.reduce((acc, r) => acc + (r.deduction_applied || 0), 0)} Days`, icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20 text-red-400' },
              { label: 'Unexempted Lates', value: lateRecords.filter(r => !r.late_approved && !r.permission_approved && !r.shift_override && !r.manager_exemption && r.status !== 'Approved WFH').length, icon: Clock, color: 'text-navy-900', bg: 'bg-white border-zinc-200 text-zinc-600' },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl p-4 border shadow-sm flex items-center gap-3 bg-white border-zinc-200", s.bg)}>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-white border border-zinc-200 shadow-sm", s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-navy-900 leading-none">{s.value}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lates Trend Chart */}
            <Card hover={false} className="p-6 rounded-2xl border border-zinc-200 bg-white lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider mb-4">Lateness Trend (This Month)</h3>
                <div className="space-y-4">
                  {employeeLatesTrend.length === 0 ? (
                    <p className="text-xs text-zinc-500 font-bold italic py-8 text-center">No lates recorded this month.</p>
                  ) : (
                    employeeLatesTrend.slice(0, 5).map((t) => {
                      const maxLates = Math.max(...employeeLatesTrend.map(x => x.total));
                      const percent = maxLates > 0 ? (t.total / maxLates) * 100 : 0;
                      const isHighRisk = t.unexempted >= 6;
                      const isMedRisk = t.unexempted >= 3 && t.unexempted < 6;

                      return (
                        <div key={t.employee_name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-navy-900">{t.employee_name}</span>
                            <span className="font-semibold text-zinc-500">
                              {t.total} Lates ({t.unexempted} Active)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded bg-white overflow-hidden border border-zinc-200/40">
                            <div 
                              className={cn(
                                "h-full rounded transition-all duration-500",
                                isHighRisk ? "bg-red-500" :
                                isMedRisk ? "bg-amber-500" :
                                "bg-emerald-500"
                              )} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <p className="text-[9px] text-zinc-500 mt-6 font-bold leading-normal uppercase tracking-wider border-t border-zinc-200/50 pt-4">
                💡 3+ Active Lates triggers a 0.5 Day deduction. 6+ Active Lates triggers a 1.0 Day deduction.
              </p>
            </Card>

            {/* Late Logins Register */}
            <Card hover={false} className="p-0 overflow-hidden border border-zinc-200 rounded-2xl shadow-sm bg-white lg:col-span-2">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50/30 flex items-center justify-between">
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider">Late Logins Register</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/50">
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">Staff Member</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">Date</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">Check In</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">Delay</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">Deduction</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500 text-center">Exemption Toggles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/60">
                    {lateRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-xs text-zinc-500 font-bold">
                          No late check-in instances found in this period.
                        </td>
                      </tr>
                    ) : (
                      lateRecords.map((record) => {
                        const hasDeduction = (record.deduction_applied || 0) > 0;
                        return (
                          <tr key={record.id} className="group hover:bg-zinc-50/30 transition-colors">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs font-semibold text-navy-900 tracking-tight">{record.employee_name}</span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-[10px] font-semibold text-zinc-500">
                                {!isNaN(new Date(record.date).getTime()) 
                                  ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase() 
                                  : record.date}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs font-medium text-navy-900">{record.check_in}</span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs font-black text-amber-400 font-mono">
                                +{record.late_minutes}m
                              </span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {hasDeduction ? (
                                <span className="bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">
                                  -{record.deduction_applied} Day
                                </span>
                              ) : (
                                <span className="text-slate-650 text-xs font-bold font-mono">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {[
                                  { key: 'late_approved', label: 'Appr. Late' },
                                  { key: 'permission_approved', label: 'Permission' },
                                  { key: 'shift_override', label: 'Override' },
                                  { key: 'manager_exemption', label: 'Exempt' },
                                ].map((ex) => {
                                  const val = (record as any)[ex.key] || false;
                                  const loadingKey = `${record.id}-${ex.key}`;
                                  const isLoading = loadingRows[loadingKey];
                                  return (
                                    <button
                                      key={ex.key}
                                      disabled={isLoading}
                                      onClick={() => handleToggleExemption(record.id, ex.key, val)}
                                      className={cn(
                                        "px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider border cursor-pointer select-none transition-all disabled:opacity-50",
                                        val 
                                          ? "bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-500/10"
                                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-navy-800 hover:text-navy-900"
                                      )}
                                    >
                                      {isLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : ex.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Slide-out details drawer */}
      {isDrawerOpen && selectedRecord && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" 
            onClick={() => {
              if (!isSubmittingOverride) {
                setIsDrawerOpen(false);
                setSelectedRecord(null);
              }
            }}
          />
          
          {/* Drawer container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col text-navy-900"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/40">
              <div>
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider">
                  Session Details
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
                  {selectedRecord.employee_name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setSelectedRecord(null);
                }}
                disabled={isSubmittingOverride}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-zinc-500 hover:text-navy-900 hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Event Timeline */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Session Overview Card */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/40 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Date</span>
                    <span className="font-semibold text-navy-900">
                      {selectedRecord.date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">State</span>
                    <span className={cn(
                      "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase mt-0.5",
                      statusColors[selectedRecord.status?.toLowerCase()] || statusColors.present
                    )}>
                      {selectedRecord.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Check-in</span>
                    <span className="font-semibold text-navy-900">{selectedRecord.check_in || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Check-out</span>
                    <span className="font-semibold text-navy-900">{selectedRecord.check_out || '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200/40 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Productive Hours</span>
                    <span className="font-mono font-bold text-navy-900">
                      {selectedRecord.productive_hours !== undefined ? selectedRecord.productive_hours.toFixed(1) : selectedRecord.duration_hours.toFixed(1)} hrs
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Break Time</span>
                    <span className="font-mono font-bold text-navy-900">
                      {selectedRecord.total_break_seconds !== undefined ? Math.round(selectedRecord.total_break_seconds / 60) : 0} mins
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline Container */}
              <div className="space-y-4 relative">
                <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-widest block mb-4 border-b border-zinc-200/40 pb-1">
                  Immutable Telemetry Timeline
                </h4>

                {isLoadingEvents ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-500 text-xs font-bold gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                    <span>Retrieving event stream logs...</span>
                  </div>
                ) : selectedRecordEvents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 font-bold border border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-50/40">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p>No telemetry logs found.</p>
                    <p className="font-normal text-[10px] text-zinc-400 mt-1">This record predates the event-sourcing ledger.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200">
                    {selectedRecordEvents.map((evt, idx) => {
                      const date = new Date(evt.event_timestamp);
                      const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
                      
                      let dotColor = 'bg-gray-500';
                      let iconColor = 'text-gray-400';
                      let cardBg = 'bg-zinc-50 border-zinc-200 text-zinc-700';
                      let description = '';

                      switch(evt.event_type) {
                        case 'CLOCK_IN':
                          dotColor = 'bg-emerald-500 ring-4 ring-emerald-500/20';
                          iconColor = 'text-emerald-600';
                          cardBg = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                          description = `Geofence: ${evt.payload?.within_geofence ? 'OK' : 'OUTSIDE'} (${evt.payload?.distance_meters ? Math.round(evt.payload.distance_meters) + 'm' : 'Unknown'})\nIP: ${evt.client_ip || '—'}`;
                          break;
                        case 'CLOCK_OUT':
                        case 'FORCE_LOGOUT':
                          dotColor = 'bg-red-500 ring-4 ring-red-500/20';
                          iconColor = 'text-red-600';
                          cardBg = 'bg-red-50 border-red-100 text-red-800';
                          description = `${evt.event_type === 'FORCE_LOGOUT' ? 'Admin Force Logout' : 'Self Clock Out'}\nIP: ${evt.client_ip || '—'}${evt.payload?.reason ? '\nJustification: ' + evt.payload.reason : ''}`;
                          break;
                        case 'BREAK_STARTED':
                          dotColor = 'bg-amber-500';
                          iconColor = 'text-amber-600';
                          description = `Self initiated lunch/rest break`;
                          break;
                        case 'BREAK_ENDED':
                          dotColor = 'bg-emerald-400';
                          iconColor = 'text-emerald-600';
                          description = `Resumed operations${evt.payload?.reason ? '\nAdmin reversal: ' + evt.payload.reason : ''}`;
                          break;
                        case 'AUTO_BREAK_TRIGGERED':
                          dotColor = 'bg-red-500 animate-pulse ring-4 ring-red-500/10';
                          iconColor = 'text-red-600';
                          cardBg = 'bg-red-50 border-red-100 text-red-800';
                          description = `Automatic break enforcement (No heartbeat activity detected for 5 minutes)`;
                          break;
                        case 'IDLE_WARNING':
                          dotColor = 'bg-amber-400';
                          iconColor = 'text-amber-500';
                          description = `Idle popup triggered (No telemetry for 3 minutes)`;
                          break;
                        case 'GPS_EXIT':
                          dotColor = 'bg-amber-500 ring-4 ring-amber-500/10';
                          iconColor = 'text-amber-600';
                          description = `GPS coordinate change: User exited the office bounds. Countdown started.`;
                          break;
                        case 'GPS_REENTRY':
                          dotColor = 'bg-emerald-400';
                          iconColor = 'text-emerald-500';
                          description = `GPS coordinate change: User returned within geofence boundaries.`;
                          break;
                        case 'ADMIN_OVERRIDE':
                          dotColor = 'bg-violet-500 ring-4 ring-violet-500/20';
                          iconColor = 'text-violet-600';
                          cardBg = 'bg-violet-50 border-violet-100 text-violet-800';
                          description = `Override: ${evt.payload?.override_field}\nFrom: ${String(evt.payload?.old_value)} → To: ${String(evt.payload?.new_value)}\nReason: ${evt.payload?.reason || '—'}`;
                          break;
                        case 'HEARTBEAT_RECEIVED':
                          dotColor = 'bg-blue-400';
                          iconColor = 'text-blue-500';
                          const clicks = evt.payload?.clicks_count ?? evt.payload?.telemetry?.clicks ?? 0;
                          const keys = evt.payload?.keys_count ?? evt.payload?.telemetry?.keys ?? 0;
                          description = `Heartbeat check secure. Keyboard/Mouse telemetry: ${clicks} clicks, ${keys} keystrokes.`;
                          break;
                        case 'MOBILE_CLOCK_IN':
                          dotColor = 'bg-violet-500 ring-4 ring-violet-500/20';
                          iconColor = 'text-violet-600';
                          cardBg = 'bg-violet-50 border-violet-100 text-violet-800';
                          description = `Mobile Clock-In initiated. Grace period activated.\nDevice: ${evt.payload?.device_label || 'Mobile'}\nIP: ${evt.client_ip || '—'}`;
                          break;
                        case 'DESKTOP_SESSION_VERIFIED':
                          dotColor = 'bg-emerald-500 ring-4 ring-emerald-500/20';
                          iconColor = 'text-emerald-600';
                          cardBg = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                          description = `Workstation verified. Productive time accumulating.\nDevice: ${evt.payload?.device_label || 'Workstation'}\nIP: ${evt.client_ip || '—'}`;
                          break;
                        case 'DESKTOP_SESSION_MISSING':
                          dotColor = 'bg-red-500 ring-4 ring-red-500/20';
                          iconColor = 'text-red-600';
                          cardBg = 'bg-red-50 border-red-100 text-red-800';
                          description = `Workstation verification missed. Grace period expired. Productive time paused.`;
                          break;
                        case 'PRODUCTIVE_TIMER_PAUSED':
                          dotColor = 'bg-amber-500 ring-4 ring-amber-500/20';
                          iconColor = 'text-amber-600';
                          cardBg = 'bg-amber-50 border-amber-100 text-amber-800';
                          description = `Productive work timer paused.`;
                          break;
                        case 'PRODUCTIVE_TIMER_RESUMED':
                          dotColor = 'bg-emerald-450 ring-4 ring-emerald-500/20';
                          iconColor = 'text-emerald-600';
                          cardBg = 'bg-emerald-50/50 border-emerald-100 text-emerald-800';
                          description = `Productive work timer resumed.`;
                          break;
                      }

                      return (
                        <div key={evt.id || idx} className="relative group/item">
                          {/* Circle dot on the timeline line */}
                          <div className={cn(
                            "absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border border-white z-10",
                            dotColor
                          )} />
                          
                          {/* Event details card */}
                          <div className={cn("p-3 rounded-xl border text-xs shadow-sm space-y-1", cardBg)}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-navy-900 tracking-tight">{evt.event_type}</span>
                              <span className="text-[10px] font-mono text-zinc-500">{timeStr}</span>
                            </div>
                            <p className="text-[10px] text-zinc-700 whitespace-pre-line leading-relaxed">
                              {description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Drawer Panel */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50/80 space-y-3">
              {/* Action Selector Toggles */}
              {!overrideActionType ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                    Operational Administrative Controls
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOverrideActionType('reverse_autobreak')}
                      className="px-2.5 py-2 rounded-lg bg-amber-500 text-white font-semibold text-[10px] tracking-tight uppercase shadow-sm shadow-amber-500/10 hover:bg-amber-600 active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Reverse Auto-Break
                    </button>
                    <button
                      onClick={() => setOverrideActionType('correct_clockout')}
                      className="px-2.5 py-2 rounded-lg bg-teal-600 text-white font-semibold text-[10px] tracking-tight uppercase shadow-sm shadow-teal-500/10 hover:bg-teal-700 active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Correct Clock-Out
                    </button>
                    <button
                      onClick={() => setOverrideActionType('override_validation')}
                      className="px-2.5 py-2 rounded-lg bg-violet-600 text-white font-semibold text-[10px] tracking-tight uppercase shadow-sm shadow-violet-500/10 hover:bg-violet-700 active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Device Override
                    </button>
                    <button
                      onClick={() => setOverrideActionType('rebuild')}
                      className="px-2.5 py-2 rounded-lg bg-zinc-100 text-navy-900 border border-zinc-200 font-semibold text-[10px] tracking-tight uppercase shadow-sm hover:bg-zinc-200 active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Rebuild Session
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOverrideSubmit} className="space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between border-b border-zinc-200/40 pb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-navy-900">
                        {overrideActionType === 'reverse_autobreak' && 'Action: Reverse Auto-Break'}
                        {overrideActionType === 'correct_clockout' && 'Action: Correct Clock-Out Time'}
                        {overrideActionType === 'override_validation' && 'Action: Device validation override'}
                        {overrideActionType === 'rebuild' && 'Action: Force Projection Rebuild'}
                      </span>
                      <button 
                        type="button"
                        onClick={() => setOverrideActionType(null)}
                        className="text-[10px] text-zinc-500 font-bold hover:text-navy-900 uppercase"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Clockout datetime selector if needed */}
                    {overrideActionType === 'correct_clockout' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                          Adjusted Clock-out Time (Local Time)
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={clockOutTimeCorrection}
                          onChange={(e) => setClockOutTimeCorrection(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 bg-white rounded text-xs text-navy-900 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {overrideActionType === 'override_validation' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                          Validation Override Type
                        </label>
                        <select
                          required
                          value={validationOverrideType}
                          onChange={(e) => setValidationOverrideType(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 bg-white rounded text-xs text-navy-900 focus:ring-1 focus:ring-primary-500 focus:outline-none font-semibold uppercase tracking-wider"
                        >
                          <option value="approve_mobile">Approve Mobile Only</option>
                          <option value="resume_timer">Resume Timer (Desktop Active)</option>
                          <option value="field_work">Field-Work Exception (Desktop Active)</option>
                        </select>
                      </div>
                    )}

                    {/* Justification Text Area (Mandatory for overrides) */}
                    {overrideActionType !== 'rebuild' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                          Override Justification Reason (Mandatory)
                        </label>
                        <textarea
                          placeholder="Provide the compliance or operations reason for this correction..."
                          required
                          rows={2}
                          value={overrideJustification}
                          onChange={(e) => setOverrideJustification(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 bg-white rounded text-xs text-navy-900 focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-zinc-400"
                        />
                      </div>
                    )}

                    {overrideActionType === 'rebuild' && (
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        This will delete the daily attendance cache projections for this session and fully recalculate them by replaying the event telemetry stream sequentially. Use this if the dashboard counters are out of sync.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingOverride}
                      className={cn(
                        "w-full text-[10px] uppercase font-bold py-2 rounded-lg text-white shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer",
                        overrideActionType === 'reverse_autobreak' ? 'bg-amber-500 hover:bg-amber-600' :
                        overrideActionType === 'correct_clockout' ? 'bg-teal-600 hover:bg-teal-700' :
                        overrideActionType === 'override_validation' ? 'bg-violet-600 hover:bg-violet-750' :
                        'bg-primary-500 hover:bg-primary-600'
                      )}
                    >
                      {isSubmittingOverride ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Apply Override & Replay Ledgers'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
