'use client';

import { useState, useMemo, useEffect, useCallback, Fragment, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  User, 
  Clock, 
  Calendar, 
  MapPin, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  Wifi, 
  Smartphone, 
  Monitor, 
  ChevronDown, 
  ChevronRight,
  Coffee,
  ShieldAlert,
  Gavel,
  Activity,
  Signal,
  Info,
  ExternalLink
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { 
  exportAttendanceExcel, 
  toggleExemption, 
  getSessionEvents, 
  reverseAutoBreak, 
  correctClockOutTime, 
  rebuildSessionProjection, 
  overrideDeviceValidation,
  getRealtimeAttendanceUpdates,
  getSingleAdminAttendanceRecord
} from './actions';
import { useToast } from '@/components/ui/Toast';
import { cn, getISTShiftDate } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface AttendanceEvent {
  id: string;
  session_id: string;
  employee_id: string;
  employee_name?: string;
  event_type: string;
  event_timestamp: string;
  payload: any;
  client_ip?: string | null;
  sequence_number?: number;
}

export interface SystemHealthNode {
  node_name: string;
  status: string;
  color?: string;
  id?: string;
  last_checked?: string;
}

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
  last_heartbeat_at?: string | null;
  productive_seconds?: number | null;
  break_seconds?: number | null;
}



function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || '';
  const getTheme = () => {
    if (['working', 'present', 'approved wfh'].includes(s)) {
      return { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dot: 'bg-emerald-500' };
    }
    if (['idle', 'late', 'pending wfh'].includes(s)) {
      return { bg: 'bg-amber-500/10 text-amber-605 border-amber-500/20', dot: 'bg-amber-500' };
    }
    if (['break (auto)', 'rejected wfh', 'absent'].includes(s)) {
      return { bg: 'bg-orange-500/10 text-orange-600 border-orange-500/20', dot: 'bg-orange-500' };
    }
    if (['break'].includes(s)) {
      return { bg: 'bg-sky-500/10 text-sky-600 border-sky-500/20', dot: 'bg-sky-500' };
    }
    if (['logged out', 'clocked_out', 'logged_out', 'force_logged_out', 'force_logout'].includes(s)) {
      return { bg: 'bg-zinc-500/10 text-zinc-650 border-zinc-500/20', dot: 'bg-zinc-550' };
    }
    if (s === 'half-day') {
      return { bg: 'bg-blue-500/10 text-blue-650 border-blue-500/20', dot: 'bg-blue-500' };
    }
    return { bg: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20', dot: 'bg-zinc-400' };
  };

  const theme = getTheme();

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[8px] font-mono font-medium border uppercase tracking-wider',
      theme.bg
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', theme.dot)} />
      {status}
    </span>
  );
}

const getRowHighlightClass = (record: AttendanceRecord, breakSecs: number) => {
  const status = record.status;
  if (status === 'Idle') {
    return 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/50';
  }
  if (status === 'Break (Auto)') {
    return 'bg-orange-50/50 border-orange-200 hover:bg-orange-100/50';
  }
  if (status === 'Break' && breakSecs > 15 * 60) {
    return 'bg-red-50/50 border-red-200 hover:bg-red-100/50';
  }
  return 'hover:bg-zinc-50';
};

const formatRelativeTime = (isoString: string | null | undefined) => {
  if (!isoString) return 'No activity';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs === 1) return '1 hour ago';
  return `${diffHrs} hours ago`;
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
  const [quickFilter, setQuickFilter] = useState<string>('all');
  const lastActiveTimeRef = useRef<number>(Date.now());
  const isPollingPausedRef = useRef<boolean>(false);
  const { toast } = useToast();

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedRecordEvents, setSelectedRecordEvents] = useState<AttendanceEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Override action state
  const [overrideActionType, setOverrideActionType] = useState<'reverse_autobreak' | 'correct_clockout' | 'rebuild' | 'override_validation' | null>(null);
  const [validationOverrideType, setValidationOverrideType] = useState<'approve_mobile' | 'resume_timer' | 'field_work'>('approve_mobile');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [clockOutTimeCorrection, setClockOutTimeCorrection] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [records, setRecords] = useState<AttendanceRecord[]>(initialAttendance);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, employeeFilter, statusFilter, riskFilter, quickFilter]);

  useEffect(() => {
    setRecords(initialAttendance);
  }, [initialAttendance]);

  const refreshRecordInState = async (recordId: string) => {
    try {
      const updatedRecord = await getSingleAdminAttendanceRecord(recordId);
      if (updatedRecord) {
        setRecords((prev) => prev.map((r) => r.id === recordId ? updatedRecord : r));
        if (selectedRecord && selectedRecord.id === recordId) {
          setSelectedRecord(updatedRecord);
        }
      }
    } catch (err) {
      console.error('Failed to reconcile local record state:', err);
    }
  };

  // Realtime Data state
  const [realtimeData, setRealtimeData] = useState<{
    metrics: {
      activeWorkforce: number;
      activeBreaks: number;
      idleWarnings: number;
      gpsAlerts: number;
      mobileSessions: number;
      staleSessions: number;
      autoBreaks: number;
      pendingDisputes: number;
    };
    latestEvents: AttendanceEvent[];
    systemHealth: SystemHealthNode[];
  } | null>(null);

  const fetchRealtimeUpdates = useCallback(async () => {
    try {
      const data = await getRealtimeAttendanceUpdates();
      setRealtimeData(data);
    } catch (err) {
      console.error('Failed to fetch realtime updates:', err);
    }
  }, []);

  // Set up polling and synchronization loop with visibility & inactivity checks
  useEffect(() => {
    let updatesInterval: NodeJS.Timeout | null = null;
    let routerRefreshInterval: NodeJS.Timeout | null = null;

    const handleResume = () => {
      lastActiveTimeRef.current = Date.now();
      if (isPollingPausedRef.current) {
        console.log('[Admin Polling]: Resumed polling.');
        isPollingPausedRef.current = false;
        fetchRealtimeUpdates();
        router.refresh();
      }
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleResume();
      }
    };

    const handleActivity = () => {
      handleResume();
    };

    // Register listeners
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleResume);
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    // Initial fetch and start intervals.
    // The router refresh is delayed by 15s so it is staggered against the KPI poll,
    // preventing a double-fetch burst every 30 seconds.
    fetchRealtimeUpdates();
    updatesInterval = setInterval(() => {
      const isHidden = document.hidden;
      const isInactive = Date.now() - lastActiveTimeRef.current > 5 * 60 * 1000;
      if (isHidden || isInactive) {
        if (!isPollingPausedRef.current) {
          console.log(`[Admin Polling]: Paused due to ${isHidden ? 'hidden tab' : 'inactivity'}`);
          isPollingPausedRef.current = true;
        }
        return;
      }
      fetchRealtimeUpdates();
    }, 30000);

    // Start router refresh 15s after mount so it fires at t=15, 45, 75… while KPI fires at t=0, 30, 60…
    const staggerTimeout = setTimeout(() => {
      routerRefreshInterval = setInterval(() => {
        const isHidden = document.hidden;
        const isInactive = Date.now() - lastActiveTimeRef.current > 5 * 60 * 1000;
        if (!isHidden && !isInactive) {
          router.refresh();
        }
      }, 30000);
    }, 15000);

    return () => {
      if (updatesInterval) clearInterval(updatesInterval);
      if (routerRefreshInterval) clearInterval(routerRefreshInterval);
      clearTimeout(staggerTimeout);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleResume);
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [fetchRealtimeUpdates, router]);

  const handleOpenDrawer = async (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
    setIsLoadingEvents(true);
    setOverrideActionType(null);
    setOverrideJustification('');
    setClockOutTimeCorrection('');
    
    if (record.check_out_raw) {
      const localDate = new Date(record.check_out_raw);
      const tzOffset = localDate.getTimezoneOffset() * 60000;
      const formatted = new Date(localDate.getTime() - tzOffset).toISOString().slice(0, 16);
      setClockOutTimeCorrection(formatted);
    } else if (record.check_in_raw) {
      const localDate = new Date(record.check_in_raw);
      localDate.setHours(localDate.getHours() + 9);
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
      
      const updatedEvents = await getSessionEvents(selectedRecord.id);
      setSelectedRecordEvents(updatedEvents);
      await refreshRecordInState(selectedRecord.id);
      await fetchRealtimeUpdates();
      setOverrideActionType(null);
      setOverrideJustification('');
      
      router.refresh();
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

  const todayISTStr = useMemo(() => {
    return getISTShiftDate(new Date());
  }, []);

  const filterCounts = useMemo(() => {
    return {
      all: records.length,
      active: records.filter(r => r.status === 'Working').length,
      breaks: records.filter(r => ['Break', 'Break (Auto)'].includes(r.status)).length,
      idle: records.filter(r => r.status === 'Idle').length,
      gps: records.filter(r => r.risk_reasons?.some(re => re.signal.toLowerCase().includes('gps') || re.detail.toLowerCase().includes('geofence'))).length,
      mobile: records.filter(r => r.device_type === 'mobile' || r.device_type === 'tablet').length,
      stale: records.filter(r => r.status === 'Working' && r.check_out === null && r.duration_hours > 12).length,
      disputes: records.filter(r => r.status === 'pending wfh' || r.status === 'Pending WFH').length,
      autobreaks: records.filter(r => r.status === 'Break (Auto)').length,
    };
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch = !search || (r.employee_name || '').toLowerCase().includes(search.toLowerCase());
      const matchesEmployee = employeeFilter === 'all' || r.employee_id === employeeFilter;
      const matchesStatus = statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesRisk = riskFilter === 'all' || (r.risk_level || 'low').toLowerCase() === riskFilter.toLowerCase();
      
      // Quick filter pills
      let matchesQuick = true;
      if (quickFilter === 'active') {
        matchesQuick = r.status === 'Working';
      } else if (quickFilter === 'idle') {
        matchesQuick = r.status === 'Idle';
      } else if (quickFilter === 'breaks') {
        matchesQuick = ['Break', 'Break (Auto)'].includes(r.status);
      } else if (quickFilter === 'mobile') {
        matchesQuick = r.device_type === 'mobile' || r.device_type === 'tablet';
      } else if (quickFilter === 'stale') {
        matchesQuick = r.status === 'Working' && r.check_out === null && r.duration_hours > 12;
      } else if (quickFilter === 'gps') {
        matchesQuick = r.risk_reasons?.some(re => re.signal.toLowerCase().includes('gps') || re.detail.toLowerCase().includes('geofence')) || false;
      } else if (quickFilter === 'disputes') {
        matchesQuick = r.status === 'pending wfh' || r.status === 'Pending WFH';
      } else if (quickFilter === 'autobreaks') {
        matchesQuick = r.status === 'Break (Auto)';
      }
      
      return matchesSearch && matchesEmployee && matchesStatus && matchesRisk && matchesQuick;
    });
  }, [records, search, employeeFilter, statusFilter, riskFilter, quickFilter]);

  const ITEMS_PER_PAGE = 50;
  const paginatedItems = useMemo(() => {
    return filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  }, [filtered.length]);

  const liveRecords = useMemo(() => {
    return records.filter((r) => {
      const isToday = r.date === todayISTStr;
      const isActive = ['Working', 'Idle', 'Break', 'Break (Auto)'].includes(r.status) && r.check_out === null;
      return isToday || isActive;
    });
  }, [records, todayISTStr]);

  const lateRecords = useMemo(() => {
    return records.filter((r) => r.is_late);
  }, [records]);

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

  const getRealtimeDurations = (record: AttendanceRecord) => {
    const isClockedOut = !!record.check_out_raw || record.status === 'Logged Out' || record.status === 'clocked_out';
    const now = Date.now();
    
    let productiveSecs = 0;
    let breakSecs = 0;
    let idleSecs = 0;
    let sessionSecs = 0;

    if (isClockedOut) {
      productiveSecs = record.productive_seconds ?? ((record.productive_hours ?? record.duration_hours) * 3600);
      breakSecs = record.break_seconds ?? (record.total_break_seconds ?? 0);
      if (record.check_in_raw && record.check_out_raw) {
        sessionSecs = Math.floor((new Date(record.check_out_raw).getTime() - new Date(record.check_in_raw).getTime()) / 1000);
      } else {
        sessionSecs = productiveSecs + breakSecs;
      }
    } else {
      const checkInMs = record.check_in_raw ? new Date(record.check_in_raw).getTime() : now;
      sessionSecs = Math.max(0, Math.floor((now - checkInMs) / 1000));
      
      const accumulatedBreak = record.break_seconds ?? (record.total_break_seconds ?? 0);
      if (['Break', 'Break (Auto)'].includes(record.status) && record.current_break_start) {
        const breakStartMs = new Date(record.current_break_start).getTime();
        breakSecs = accumulatedBreak + Math.max(0, Math.floor((now - breakStartMs) / 1000));
      } else {
        breakSecs = accumulatedBreak;
      }
      
      if (record.status === 'Idle') {
        idleSecs = Math.max(0, sessionSecs - breakSecs - (record.productive_seconds ?? ((record.productive_hours ?? 0) * 3600)));
      }
      
      if (record.status === 'Working' || record.status === 'Idle') {
        productiveSecs = Math.max(0, sessionSecs - breakSecs);
      } else {
        productiveSecs = record.productive_seconds ?? ((record.productive_hours ?? 0) * 3600);
      }
    }

    return {
      productive: formatDuration(productiveSecs),
      break: formatDuration(breakSecs),
      idle: formatDuration(idleSecs),
      session: formatDuration(sessionSecs),
      isClockedOut,
      productiveSecs,
      breakSecs,
      idleSecs,
      sessionSecs
    };
  };



  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleExemption = async (recordId: string, fieldName: string, currentVal: boolean) => {
    const key = `${recordId}-${fieldName}`;
    setLoadingRows((prev) => ({ ...prev, [key]: true }));
    try {
      await toggleExemption(recordId, fieldName, !currentVal);
      await refreshRecordInState(recordId);
      toast.success('Exemption status updated successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update exemption.');
    } finally {
      setLoadingRows((prev) => ({ ...prev, [key]: false }));
    }
  };

  const exportCsv = () => {
    const headers = 'Employee,Date,Check In,Check Out,Total Hours,Break Time,Status,Latitude,Longitude';
    const rows = filtered.map((r) => {
      const times = getRealtimeDurations(r);
      return `"${r.employee_name}","${r.date}","${r.check_in || ''}","${r.check_out || ''}","${times.productive}","${times.break}","${r.status}",${r.lat},${r.lng}`;
    });
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

  const kpiItems = [
    { label: 'Active Workforce', value: realtimeData?.metrics.activeWorkforce ?? 0, color: 'from-emerald-500 to-teal-600', icon: Activity, pulse: true },
    { label: 'Active Breaks', value: realtimeData?.metrics.activeBreaks ?? 0, color: 'from-amber-400 to-orange-500', icon: Coffee },
    { label: 'Idle Warnings', value: realtimeData?.metrics.idleWarnings ?? 0, color: 'from-yellow-400 to-amber-500', icon: AlertTriangle },
    { label: 'GPS Alerts', value: realtimeData?.metrics.gpsAlerts ?? 0, color: 'from-rose-500 to-red-600', icon: MapPin },
    { label: 'Mobile-Only', value: realtimeData?.metrics.mobileSessions ?? 0, color: 'from-violet-500 to-purple-600', icon: Smartphone },
    { label: 'Stale Sessions', value: realtimeData?.metrics.staleSessions ?? 0, color: 'from-red-600 to-rose-700', icon: ShieldAlert },
    { label: 'Auto-Breaks Today', value: realtimeData?.metrics.autoBreaks ?? 0, color: 'from-red-400 to-orange-600', icon: Clock },
    { label: 'Pending Disputes', value: realtimeData?.metrics.pendingDisputes ?? 0, color: 'from-blue-500 to-indigo-600', icon: Gavel }
  ];

  const renderActivityFeed = () => (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 flex flex-col h-full max-h-[600px] overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-155 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <h3 className="font-heading font-black text-xs text-navy-900 uppercase tracking-wider">
            Realtime Activity
          </h3>
        </div>
        <span className="text-[9px] text-zinc-400 font-mono">LIVE</span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {!realtimeData || realtimeData.latestEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 italic">
            No recent activity events.
          </div>
        ) : (
          realtimeData.latestEvents.slice(0, 15).map((evt) => {
            const time = new Date(evt.event_timestamp);
            const timeString = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            let badgeColor = 'bg-zinc-100 text-zinc-650 border-zinc-200';
            let title = evt.event_type;
            
            switch (evt.event_type) {
              case 'CLOCK_IN':
                badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                break;
              case 'CLOCK_OUT':
              case 'FORCE_LOGOUT':
                badgeColor = 'bg-red-50 text-red-600 border-red-100';
                break;
              case 'BREAK_STARTED':
              case 'BREAK_ENDED':
              case 'AUTO_BREAK_TRIGGERED':
                badgeColor = 'bg-amber-50 text-amber-600 border-amber-100';
                break;
              case 'HEARTBEAT_RECEIVED':
                badgeColor = 'bg-blue-50 text-blue-650 border-blue-100';
                title = 'HEARTBEAT';
                break;
              case 'ADMIN_OVERRIDE':
                badgeColor = 'bg-violet-50 text-violet-650 border-violet-100';
                break;
              default:
                badgeColor = 'bg-zinc-50 text-zinc-650 border-zinc-200';
            }
            
            const matchRecord = records.find(r => r.id === evt.session_id);
            
            return (
              <div 
                key={evt.id}
                onClick={() => matchRecord && handleOpenDrawer(matchRecord)}
                className={cn(
                  "p-2.5 rounded-lg border border-zinc-150 bg-zinc-50/50 hover:bg-zinc-100/50 transition-all text-[11px] leading-relaxed cursor-pointer select-none",
                  matchRecord ? "hover:border-primary-400" : "opacity-80"
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-extrabold text-navy-900 truncate max-w-[120px]" title={evt.employee_name}>
                    {evt.employee_name}
                  </span>
                  <span className="text-[8px] text-zinc-400 font-mono shrink-0">
                    {timeString}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0", badgeColor)}>
                    {title.replace(/_RECEIVED|_TRIGGERED/g, '')}
                  </span>
                  <span className="text-zinc-500 font-medium truncate max-w-[150px]" title={
                    evt.event_type === 'HEARTBEAT_RECEIVED'
                      ? `Telemetry active`
                      : evt.payload?.reason || evt.payload?.stale_reason || 'Workforce event logged'
                  }>
                    {evt.event_type === 'HEARTBEAT_RECEIVED'
                      ? `Active`
                      : evt.payload?.reason || evt.payload?.stale_reason || 'Logged'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

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

      {/* Realtime KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiItems.map((kpi) => (
          <div 
            key={kpi.label} 
            className="relative bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5 flex flex-col justify-between hover:scale-[1.02] hover:border-primary-400/50 hover:shadow-md transition-all duration-300 overflow-hidden group cursor-pointer"
            onClick={() => {
              if (kpi.label === 'Active Workforce') setQuickFilter('active');
              if (kpi.label === 'Active Breaks') setQuickFilter('breaks');
              if (kpi.label === 'Idle Warnings') setQuickFilter('idle');
              if (kpi.label === 'Mobile-Only') setQuickFilter('mobile');
              if (kpi.label === 'Stale Sessions') setQuickFilter('stale');
              if (kpi.label === 'GPS Alerts') setQuickFilter('gps');
              if (kpi.label === 'Pending Disputes') setQuickFilter('disputes');
              if (kpi.label === 'Auto-Breaks Today') setQuickFilter('autobreaks');
            }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-0 group-hover:opacity-[0.02] transition-opacity duration-300`} />
            
            <div className="flex items-center justify-between mb-2">
              <div className="p-1.5 rounded-lg bg-zinc-50 border border-zinc-100 group-hover:border-primary-200/50 transition-colors">
                <kpi.icon className="w-4 h-4 text-navy-850" />
              </div>
              {kpi.pulse && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-black text-navy-900 tracking-tight">{kpi.value}</p>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1 leading-snug">
                {kpi.label}
              </p>
            </div>
          </div>
        ))}
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
                  <option value="Working">WORKING</option>
                  <option value="Idle">IDLE</option>
                  <option value="Break">BREAK</option>
                  <option value="Break (Auto)">BREAK (AUTO)</option>
                  <option value="Logged Out">LOGGED OUT</option>
                  <option value="Present">PRESENT</option>
                  <option value="Late">LATE</option>
                  <option value="Absent">ABSENT</option>
                  <option value="Half-day">HALF-DAY</option>
                  <option value="Pending WFH">WFH PENDING</option>
                  <option value="Approved WFH">WFH APPROVED</option>
                  <option value="Rejected WFH">WFH REJECTED</option>
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

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap px-1">
            {[
              { id: 'all', label: 'All Records', count: filterCounts.all },
              { id: 'active', label: 'Active', count: filterCounts.active },
              { id: 'breaks', label: 'On Break', count: filterCounts.breaks },
              { id: 'idle', label: 'Idle', count: filterCounts.idle },
              { id: 'gps', label: 'GPS Alerts', count: filterCounts.gps },
              { id: 'mobile', label: 'Mobile', count: filterCounts.mobile },
              { id: 'stale', label: 'Stale', count: filterCounts.stale },
              { id: 'disputes', label: 'Disputes', count: filterCounts.disputes },
              { id: 'autobreaks', label: 'Auto-Breaks', count: filterCounts.autobreaks },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setQuickFilter(pill.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all active:scale-95",
                  quickFilter === pill.id
                    ? "bg-primary-500 text-white border-primary-500 shadow-sm shadow-primary-500/20"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-navy-900"
                )}
              >
                {pill.label}
                {pill.count > 0 && (
                  <span className={cn(
                    "ml-1 px-1 py-0.5 rounded-full text-[8px] font-bold leading-none",
                    quickFilter === pill.id ? "bg-white/25 text-white" : "bg-zinc-100 text-zinc-400"
                  )}>
                    {pill.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                <span className="text-navy-900 font-extrabold">{filtered.length}</span> entries synchronized
              </p>
            </div>
          </div>

          {/* Desktop Table & Realtime Split Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Left Column: Table/Cards */}
            <div className="lg:col-span-8 space-y-4">
              {/* Mobile Card Layout */}
              <div className="block md:hidden space-y-2">
                {filtered.length === 0 ? (
                  <Card hover={false} className="p-8 rounded-xl border border-zinc-200 bg-white text-center">
                    <Calendar className="w-8 h-8 text-slate-605 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 font-bold">No logs found.</p>
                  </Card>
                ) : (
                  paginatedItems.map((record) => (
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
                        <StatusBadge status={record.status} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-505 font-medium">
                        <span>
                          {!isNaN(new Date(record.date).getTime())
                            ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase()
                            : record.date?.toUpperCase() || '—'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{record.check_in || '—'} → {record.check_out || '—'}</span>
                          {(() => {
                            const times = getRealtimeDurations(record);
                            return (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded border text-[9px] font-mono",
                                times.isClockedOut ? "bg-zinc-105 text-zinc-650 border-zinc-200" : "bg-emerald-50 text-emerald-600 border-emerald-25"
                              )}>
                                {times.productive}
                              </span>
                            );
                          })()}
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

              {/* Desktop Table layout */}
              <Card hover={false} className="p-0 overflow-hidden border border-zinc-200 bg-white backdrop-blur-md rounded-xl shadow-sm hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                        <th className="w-10 px-2 py-2.5"></th>
                        <th className="px-4 py-2.5">Employee Name</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Clock In</th>
                        <th className="px-4 py-2.5">Clock Out</th>
                        <th className="px-4 py-2.5">Total Hours</th>
                        <th className="px-4 py-2.5">Break Time</th>
                        <th className="px-4 py-2.5">Final Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100/60">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-3">
                              <Calendar className="w-5 h-5 text-slate-655" />
                            </div>
                            <p className="text-xs text-zinc-505 font-bold">No synchronization logs found for this period.</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((record) => {
                          const times = getRealtimeDurations(record);
                          return (
                            <Fragment key={record.id}>
                              <tr 
                                onClick={() => handleOpenDrawer(record)}
                                className={cn(
                                  "group hover:bg-zinc-50/30 transition-colors cursor-pointer",
                                  expandedRows[record.id] && "bg-zinc-50/20"
                                )}
                              >
                                <td className="w-10 px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={(e) => toggleRow(record.id, e)}
                                    className="p-1 rounded hover:bg-zinc-150 text-zinc-505 transition-colors"
                                  >
                                    {expandedRows[record.id] ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-zinc-700 transition-colors">
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
                                  <div className="text-[10px] font-semibold text-zinc-505 font-mono">
                                    {!isNaN(new Date(record.date).getTime()) 
                                      ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() 
                                      : record.date?.toUpperCase() || '—'}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs font-semibold text-zinc-650">
                                  {record.check_in || '—'}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs font-semibold text-zinc-650">
                                  {record.check_out || '—'}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs font-bold text-navy-900">
                                  {times.productive}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs font-bold text-navy-900">
                                  {times.break}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <StatusBadge status={record.status} />
                                </td>
                              </tr>
                              {expandedRows[record.id] && (
                                <tr className="bg-zinc-50/20" onClick={(e) => e.stopPropagation()}>
                                  <td colSpan={8} className="px-6 py-4 border-b border-zinc-200">
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Geofence Telemetry</span>
                                      <p className="font-semibold text-navy-900">Coordinates: {record.lat.toFixed(6)}, {record.lng.toFixed(6)}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${record.lat},${record.lng}`}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-[10px] text-primary-600 font-bold hover:underline inline-flex items-center gap-0.5"
                                        >
                                          Google Maps <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Device Registry</span>
                                      <p className="font-semibold text-navy-900 truncate max-w-xs">{record.device_label || 'Default Workstation'}</p>
                                      <p className="text-[10px] text-zinc-450 mt-0.5 uppercase font-mono">{record.device_type || 'Desktop'}</p>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Break Diagnostics</span>
                                      <p className="font-semibold text-navy-900">Total Break: {Math.round((record.total_break_seconds ?? 0) / 60)} mins</p>
                                      {record.current_break_start && (
                                        <p className="text-[10px] text-amber-505 font-semibold animate-pulse mt-0.5">
                                          Active Break since {new Date(record.current_break_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </p>
                                      )}
                                    </div>

                                    <div className="space-y-1.5 flex flex-col justify-center">
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Admin Override Actions</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        <button
                                          onClick={() => handleOpenDrawer(record)}
                                          className="px-2 py-1 rounded bg-primary-50 hover:bg-primary-100 text-primary-600 font-bold text-[9px] uppercase tracking-wider transition-colors"
                                        >
                                          Open Drawer
                                        </button>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              await rebuildSessionProjection(record.id);
                                              toast.success('Session rebuilt successfully.');
                                              router.refresh();
                                            } catch (err) {
                                              toast.error('Rebuild failed.');
                                            }
                                          }}
                                          className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[9px] uppercase tracking-wider transition-colors"
                                        >
                                          Rebuild
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenDrawer(record).then(() => {
                                              setOverrideActionType('correct_clockout');
                                            });
                                          }}
                                          className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-600 font-bold text-[9px] uppercase tracking-wider transition-colors"
                                        >
                                          Clockout
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenDrawer(record).then(() => {
                                              setOverrideActionType('reverse_autobreak');
                                            });
                                          }}
                                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold text-[9px] uppercase tracking-wider transition-colors"
                                        >
                                          Rev Break
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </Card>

              {/* Pagination Widget */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                  <div className="text-xs text-zinc-500 font-medium">
                    Showing <span className="font-bold text-navy-900">{Math.min(filtered.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to{' '}
                    <span className="font-bold text-navy-900">{Math.min(filtered.length, currentPage * ITEMS_PER_PAGE)}</span> of{' '}
                    <span className="font-bold text-navy-900">{filtered.length}</span> entries
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 text-xs"
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      let pageNum = currentPage;
                      if (currentPage <= 3) {
                        pageNum = idx + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + idx;
                      } else {
                        pageNum = currentPage - 2 + idx;
                      }
                      
                      if (pageNum < 1 || pageNum > totalPages) return null;

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0 text-xs font-bold"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Activity Feed (lg:col-span-2) */}
            <div className="lg:col-span-2">
              {renderActivityFeed()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Left Column: Live Monitors */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <span className="text-navy-900 font-extrabold">{liveRecords.length}</span> Active Sessions Today
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Employee Name</th>
                      <th className="px-6 py-4">Current Status</th>
                      <th className="px-6 py-4">Clock In (IST)</th>
                      <th className="px-6 py-4">Work Duration</th>
                      <th className="px-6 py-4">Break Duration</th>
                      <th className="px-6 py-4">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150/60 font-sans">
                    {liveRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-zinc-400 italic">
                          No active check-ins detected today.
                        </td>
                      </tr>
                    ) : (
                      liveRecords.map((record) => {
                        const times = getRealtimeDurations(record);
                        const rowClass = getRowHighlightClass(record, times.breakSecs);
                        
                        return (
                          <tr 
                            key={record.id}
                            onClick={() => handleOpenDrawer(record)}
                            className={cn("transition-colors cursor-pointer border-b border-zinc-100", rowClass)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-700 font-bold border border-zinc-200/40 text-xs">
                                  {record.employee_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-navy-900 text-xs flex items-center gap-1.5">
                                    {record.employee_name}
                                    <span className="text-[10px]" title={record.device_label || 'Unknown device'}>
                                      {record.device_type === 'mobile' || record.device_type === 'tablet' ? '📱' : '💻'}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={record.status} />
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-semibold text-zinc-600">
                              {record.check_in || '—'}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-navy-900">
                              {times.productive}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-navy-900">
                              {times.break}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-zinc-500">
                              {formatRelativeTime(record.last_heartbeat_at)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Live Activity Feed (lg:col-span-2) */}
          <div className="lg:col-span-2">
            {renderActivityFeed()}
          </div>
        </div>
      )}

      {activeTab === 'lates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Late Logins', value: lateRecords.length, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
              { label: 'Active Deductions', value: `${lateRecords.reduce((acc, r) => acc + (r.deduction_applied || 0), 0)} Days`, icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20 text-red-400' },
              { label: 'Unexempted Lates', value: lateRecords.filter(r => !r.late_approved && !r.permission_approved && !r.shift_override && !r.manager_exemption && r.status !== 'Approved WFH').length, icon: Clock, color: 'text-navy-900', bg: 'bg-white border-zinc-200 text-zinc-650' },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl p-4 border shadow-sm flex items-center gap-3 bg-white border-zinc-200", s.bg)}>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-white border border-zinc-200 shadow-sm", s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-navy-900 leading-none">{s.value}</p>
                  <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card hover={false} className="p-6 rounded-2xl border border-zinc-200 bg-white lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider mb-4">Lateness Trend (This Month)</h3>
                <div className="space-y-4">
                  {employeeLatesTrend.length === 0 ? (
                    <p className="text-xs text-zinc-505 font-bold italic py-8 text-center">No lates recorded this month.</p>
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
                            <span className="font-semibold text-zinc-505">
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
              <p className="text-[9px] text-zinc-505 mt-6 font-bold leading-normal uppercase tracking-wider border-t border-zinc-200/50 pt-4">
                💡 3+ Active Lates triggers a 0.5 Day deduction. 6+ Active Lates triggers a 1.0 Day deduction.
              </p>
            </Card>

            <Card hover={false} className="p-0 overflow-hidden border border-zinc-200 rounded-2xl shadow-sm bg-white lg:col-span-2">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50/30 flex items-center justify-between">
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider">Late Logins Register</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/50">
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-505">Staff Member</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-505">Date</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-505">Check In</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-505">Delay</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-505">Deduction</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-505 text-center">Exemption Toggles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/60">
                    {lateRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-xs text-zinc-505 font-bold">
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
                              <span className="text-[10px] font-semibold text-zinc-505">
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

      {/* System Health Footer */}
      {realtimeData?.systemHealth && realtimeData.systemHealth.length > 0 && (
        <div className="mt-8 pt-4 border-t border-zinc-200/60 flex flex-wrap items-center justify-between gap-4 text-[10px] text-zinc-505 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-zinc-400" />
            <span>System Infrastructure Health:</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {realtimeData.systemHealth.map((node) => {
              const isOnline = node.status === 'ONLINE' || node.status === 'active' || node.status === 'healthy';
              return (
                <div key={node.node_name} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-zinc-200 shadow-sm">
                  <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                  <span>{node.node_name}:</span>
                  <span className={cn("font-extrabold font-mono", isOnline ? "text-emerald-650" : "text-red-500")}>
                    {node.status.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-out details drawer */}
      {isDrawerOpen && selectedRecord && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" 
            onClick={() => {
              if (!isSubmittingOverride) {
                setIsDrawerOpen(false);
                setSelectedRecord(null);
              }
            }}
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col text-navy-900"
          >
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-55/40">
              <div>
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider">
                  Session Details
                </h3>
                <p className="text-[10px] font-bold text-zinc-505 uppercase tracking-wider mt-0.5">
                  {selectedRecord.employee_name}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border bg-zinc-100 text-zinc-505 border-zinc-200">
                    {selectedRecord.device_type === 'mobile' || selectedRecord.device_type === 'tablet' 
                      ? <><Smartphone className="w-2.5 h-2.5" /> {selectedRecord.device_label || 'Mobile'}</>
                      : <><Monitor className="w-2.5 h-2.5" /> {selectedRecord.device_label || 'Desktop'}</>
                    }
                  </span>
                  <span className="text-[8px] font-mono text-zinc-400">ID: {selectedRecord.id.slice(0, 8)}</span>
                </div>
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

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-55/40 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">Date</span>
                    <span className="font-semibold text-navy-900">
                      {selectedRecord.date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">State</span>
                    <div className="mt-0.5">
                      <StatusBadge status={selectedRecord.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">Check-in</span>
                    <span className="font-semibold text-navy-900">{selectedRecord.check_in || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">Check-out</span>
                    <span className="font-semibold text-navy-900">{selectedRecord.check_out || '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200/40 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">Productive Hours</span>
                    <span className="font-mono font-bold text-navy-900">
                      {selectedRecord.productive_hours !== undefined ? selectedRecord.productive_hours.toFixed(1) : selectedRecord.duration_hours.toFixed(1)} hrs
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">Break Time</span>
                    <span className="font-mono font-bold text-navy-900">
                      {selectedRecord.total_break_seconds !== undefined ? Math.round(selectedRecord.total_break_seconds / 60) : 0} mins
                    </span>
                  </div>
                </div>
              </div>

              {selectedRecordEvents.length > 0 && (
                <div className="p-3 rounded-xl border border-zinc-200/60 bg-zinc-55/30 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[8px] font-black text-zinc-505 uppercase tracking-widest block">Events</span>
                    <span className="text-sm font-bold text-navy-900">{selectedRecordEvents.length}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-zinc-505 uppercase tracking-widest block">Heartbeats</span>
                    <span className="text-sm font-bold text-navy-900">
                      {selectedRecordEvents.filter(e => e.event_type === 'HEARTBEAT_RECEIVED').length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-zinc-505 uppercase tracking-widest block">GPS Pings</span>
                    <span className="text-sm font-bold text-navy-900">
                      {selectedRecordEvents.filter(e => e.event_type === 'GPS_EXIT' || e.event_type === 'GPS_REENTRY').length}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-4 relative">
                <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-widest block mb-4 border-b border-zinc-200/40 pb-1">
                  Immutable Telemetry Timeline
                </h4>

                {isLoadingEvents ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-505 text-xs font-bold gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                    <span>Retrieving event stream logs...</span>
                  </div>
                ) : selectedRecordEvents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-550 font-bold border border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-55/40">
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
                          if (evt.event_type === 'FORCE_LOGOUT' && evt.payload?.forced_by === 'system_sweeper') {
                            const staleReason = evt.payload?.stale_reason === 'heartbeat_timeout' ? 'Heartbeat Timeout' 
                              : evt.payload?.stale_reason === 'session_exceeded_16h' ? 'Session Exceeded 16h'
                              : evt.payload?.stale_reason === 'desktop_grace_expired' ? 'Desktop Grace Expired'
                              : evt.payload?.stale_reason === 'cross_shift_boundary' ? 'Cross-Shift Boundary'
                              : evt.payload?.stale_reason || 'Unknown';
                            const staleDuration = evt.payload?.stale_duration_seconds 
                              ? `${Math.round(evt.payload.stale_duration_seconds / 60)}min inactive` 
                              : '';
                            description = `⚡ System Inactivity Auto-Logout\nReason: ${staleReason}${staleDuration ? '\nInactivity: ' + staleDuration : ''}${evt.payload?.last_heartbeat_at ? '\nLast Heartbeat: ' + new Date(evt.payload.last_heartbeat_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : ''}`;
                          } else if (evt.event_type === 'FORCE_LOGOUT') {
                            description = `Admin Force Logout\nIP: ${evt.client_ip || '—'}${evt.payload?.reason ? '\nJustification: ' + evt.payload.reason : ''}`;
                          } else {
                            description = `Self Clock Out\nIP: ${evt.client_ip || '—'}${evt.payload?.reason ? '\nJustification: ' + evt.payload.reason : ''}`;
                          }
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
                          iconColor = 'text-emerald-505';
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
                          iconColor = 'text-blue-505';
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
                          <div className={cn(
                            "absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border border-white z-10",
                            dotColor
                          )} />
                          
                          <div className={cn("p-3 rounded-xl border text-xs shadow-sm space-y-1", cardBg)}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-navy-900 tracking-tight">{evt.event_type}</span>
                              <span className="text-[10px] font-mono text-zinc-500">{timeStr}</span>
                            </div>
                            <p className="text-[10px] text-zinc-700 whitespace-pre-line leading-relaxed">
                              {description}
                            </p>
                            {evt.payload && Object.keys(evt.payload).length > 0 && (
                              <details className="mt-1">
                                <summary className="text-[9px] font-mono text-zinc-400 cursor-pointer hover:text-zinc-650 select-none flex items-center gap-1">
                                  <ChevronRight className="w-2.5 h-2.5 inline-block details-open:hidden" />
                                  <span>Raw payload</span>
                                </summary>
                                <pre className="mt-1 text-[8px] font-mono text-zinc-500 bg-zinc-100 p-2 rounded border border-zinc-200 overflow-x-auto max-h-32 leading-relaxed">
                                  {JSON.stringify(evt.payload, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50/80 space-y-3">
              {!overrideActionType ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-black text-zinc-705 uppercase tracking-widest">
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
                        className="text-[10px] text-zinc-550 font-bold hover:text-navy-900 uppercase"
                      >
                        Cancel
                      </button>
                    </div>

                    {overrideActionType === 'correct_clockout' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">
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
                        <label className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">
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

                    {overrideActionType !== 'rebuild' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-505 uppercase tracking-widest block">
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
                      <p className="text-[10px] text-zinc-505 leading-relaxed">
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
