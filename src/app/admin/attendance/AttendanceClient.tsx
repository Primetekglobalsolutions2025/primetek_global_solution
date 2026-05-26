'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Download, FileSpreadsheet, Loader2, User, Clock, Calendar, MapPin, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { exportAttendanceExcel, toggleExemption } from './actions';
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
      const base64Str = await exportAttendanceExcel(year);
      
      const byteCharacters = atob(base64Str);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Primetek_Attendance_${year}_Master.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel file generated successfully.');
    } catch (error) {
      console.error('Failed to export Excel:', error);
      toast.error('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border/50 gap-2">
        {[
          { id: 'logs', label: 'Attendance Logs', icon: Calendar },
          { id: 'live', label: 'Live Monitor', icon: Clock },
          { id: 'lates', label: 'Late Login Reports', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600 font-extrabold"
                  : "border-transparent text-text-muted hover:text-navy-900"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Filter by name..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/60 bg-white text-xs text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" 
                />
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2 items-center">
                <select 
                  value={employeeFilter} 
                  onChange={(e) => setEmployeeFilter(e.target.value)} 
                  className="pl-3 pr-8 py-2 rounded-lg border border-border/60 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm min-w-0 sm:min-w-[130px] appearance-none"
                >
                  <option value="all">Personnel: ALL</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
                </select>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="pl-3 pr-8 py-2 rounded-lg border border-border/60 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm min-w-0 sm:min-w-[130px] appearance-none"
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
                </select>
                <select 
                  value={riskFilter} 
                  onChange={(e) => setRiskFilter(e.target.value)} 
                  className="pl-3 pr-8 py-2 rounded-lg border border-border/60 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm min-w-0 sm:min-w-[130px] appearance-none col-span-2 sm:col-span-1"
                >
                  <option value="all">Trust: ALL</option>
                  <option value="low">Trust: LOW RISK</option>
                  <option value="medium">Trust: MEDIUM RISK</option>
                  <option value="high">Trust: HIGH RISK</option>
                </select>
                <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                  <input
                    type="date"
                    value={startDate}
                    max={todayISTStr}
                    onChange={(e) => handleDateChange(e.target.value, endDate)}
                    className="px-2 py-2 rounded-lg border border-border/60 bg-white text-[10px] font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm w-full sm:w-[110px]"
                    placeholder="Start Date"
                  />
                  <span className="text-[10px] text-gray-400 font-bold">TO</span>
                  <input
                    type="date"
                    value={endDate}
                    max={todayISTStr}
                    onChange={(e) => handleDateChange(startDate, e.target.value)}
                    className="px-2 py-2 rounded-lg border border-border/60 bg-white text-[10px] font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm w-full sm:w-[110px]"
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={exportCsv} 
                className="rounded-lg border-border/60 font-semibold px-4 py-2 text-xs active:scale-95 transition-all shadow-sm bg-white"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
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
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                <span className="text-navy-900 font-extrabold">{filtered.length}</span> entries synchronized
              </p>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-2">
            {filtered.length === 0 ? (
              <Card hover={false} className="p-8 rounded-xl border border-border/60 shadow-sm bg-white text-center">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-text-muted font-bold">No logs found.</p>
              </Card>
            ) : (
              filtered.map((record) => (
                <Card key={record.id} hover={false} className="p-4 rounded-xl border border-border/60 shadow-sm bg-white">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-surface-alt flex items-center justify-center text-navy-900">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-navy-900 tracking-tight">{record.employee_name}</span>
                    </div>
                    <span className={cn(
                      "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase",
                      statusColors[record.status?.toLowerCase()] || statusColors.present
                    )}>
                      {record.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted font-medium">
                    <span>
                      {!isNaN(new Date(record.date).getTime())
                        ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase()
                        : record.date?.toUpperCase() || '—'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{record.check_in || '—'} → {record.check_out || '—'}</span>
                      {record.duration_hours > 0 && (
                        <span className="bg-surface-alt px-1.5 py-0.5 rounded border border-border/50 text-[10px] font-bold text-navy-900">
                          {record.duration_hours}H
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
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
                        <span className="text-[10px] font-mono text-gray-400">({record.risk_score} pts)</span>
                      )}
                    </div>
                    <MapPin className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-xl shadow-sm bg-white hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/50">
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Staff Member</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Timeline</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Clock In</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Clock Out</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Intensity</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Compliance</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Trust Engine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-3">
                          <Calendar className="w-5 h-5 text-gray-300" />
                        </div>
                        <p className="text-xs text-text-muted font-bold">No synchronization logs found for this period.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((record) => (
                      <tr key={record.id} className="group hover:bg-surface-alt/30 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-surface-alt flex items-center justify-center text-navy-900 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold text-navy-900 tracking-tight">{record.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="text-[10px] font-semibold text-text-secondary">
                            {!isNaN(new Date(record.date).getTime()) 
                              ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase() 
                              : record.date?.toUpperCase() || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs font-medium text-navy-900">
                            <Clock className="w-3.5 h-3.5 text-emerald-500/50" />
                            {record.check_in || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs font-medium text-navy-900">
                            <Clock className="w-3.5 h-3.5 text-red-500/50" />
                            {record.check_out || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="text-xs font-semibold text-text-secondary">
                            {record.duration_hours > 0 ? (
                              <span className="bg-surface-alt px-1.5 py-0.5 rounded border border-border/50 text-[10px]">
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
                              <span className="text-[10px] font-mono text-gray-400">({record.risk_score} pts)</span>
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <span className="text-navy-900 font-extrabold">{liveRecords.length}</span> Active Sessions Today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveRecords.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-border/60">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-xs text-text-muted font-bold">No active check-ins detected today.</p>
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
                      "p-5 rounded-2xl border bg-white shadow-sm transition-all duration-300 relative overflow-hidden",
                      currentStatus === 'On Break' ? "border-amber-500/30 bg-amber-500/[0.01]" : "border-border/60",
                      isOverrun && "ring-2 ring-red-500/50 border-red-500/50 bg-red-500/[0.01]"
                    )}
                  >
                    {isOverrun && (
                      <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] font-black text-center py-1 uppercase tracking-widest animate-pulse">
                        ⚠️ Break Overrun Danger (&gt; 1hr)
                      </div>
                    )}
                    
                    <div className={cn("flex items-start justify-between", isOverrun && "mt-4")}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-surface-alt flex items-center justify-center text-navy-900 font-bold border border-border/30">
                          {record.employee_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-navy-900">{record.employee_name}</h4>
                          <p className="text-[9px] text-text-muted font-bold tracking-widest mt-0.5 font-mono">
                            IN: {record.check_in || '—'}
                          </p>
                        </div>
                      </div>

                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border",
                        currentStatus === 'Working' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                        currentStatus === 'On Break' ? "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse" :
                        "bg-gray-500/10 text-gray-600 border-gray-500/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          currentStatus === 'Working' ? "bg-emerald-500 animate-pulse" :
                          currentStatus === 'On Break' ? "bg-amber-500 animate-ping" :
                          "bg-gray-500"
                        )} />
                        {currentStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border/45">
                      <div>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Productive Work</span>
                        <span className="text-xs font-black text-navy-900 font-mono tracking-tight">
                          {formatDuration(productiveSecs)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Break Duration</span>
                        <span className={cn(
                          "text-xs font-black font-mono tracking-tight flex items-center gap-1",
                          isOverrun ? "text-red-600 animate-pulse" :
                          isWarning ? "text-amber-500" :
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
              { label: 'Total Late Logins', value: lateRecords.length, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50/50 border-amber-500/20' },
              { label: 'Active Deductions', value: `${lateRecords.reduce((acc, r) => acc + (r.deduction_applied || 0), 0)} Days`, icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50/50 border-red-500/20' },
              { label: 'Unexempted Lates', value: lateRecords.filter(r => !r.late_approved && !r.permission_approved && !r.shift_override && !r.manager_exemption && r.status !== 'Approved WFH').length, icon: Clock, color: 'text-navy-900', bg: 'bg-white border-border/50' },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl p-4 border shadow-sm flex items-center gap-3 bg-white", s.bg)}>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-white shadow-sm border border-border/20", s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-navy-900 leading-none">{s.value}</p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lates Trend Chart */}
            <Card hover={false} className="p-6 rounded-2xl border border-border/60 bg-white lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider mb-4">Lateness Trend (This Month)</h3>
                <div className="space-y-4">
                  {employeeLatesTrend.length === 0 ? (
                    <p className="text-xs text-text-muted font-bold italic py-8 text-center">No lates recorded this month.</p>
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
                            <span className="font-semibold text-text-muted">
                              {t.total} Lates ({t.unexempted} Active)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded bg-surface-alt overflow-hidden border border-border/20">
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
              <p className="text-[9px] text-text-muted mt-6 font-bold leading-normal uppercase tracking-wider border-t border-border/30 pt-4">
                💡 3+ Active Lates triggers a 0.5 Day deduction. 6+ Active Lates triggers a 1.0 Day deduction.
              </p>
            </Card>

            {/* Late Logins Register */}
            <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-2xl shadow-sm bg-white lg:col-span-2">
              <div className="p-4 border-b border-border/60 bg-surface-alt/20 flex items-center justify-between">
                <h3 className="font-heading font-black text-sm text-navy-900 uppercase tracking-wider">Late Logins Register</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt/50">
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-muted">Staff Member</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-muted">Date</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-muted">Check In</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-muted">Delay</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-muted">Deduction</th>
                      <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-muted text-center">Exemption Toggles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lateRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-xs text-text-muted font-bold">
                          No late check-in instances found in this period.
                        </td>
                      </tr>
                    ) : (
                      lateRecords.map((record) => {
                        const hasDeduction = (record.deduction_applied || 0) > 0;
                        return (
                          <tr key={record.id} className="group hover:bg-surface-alt/30 transition-colors">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs font-semibold text-navy-900 tracking-tight">{record.employee_name}</span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-[10px] font-semibold text-text-secondary">
                                {!isNaN(new Date(record.date).getTime()) 
                                  ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase() 
                                  : record.date}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs font-medium text-navy-900">{record.check_in}</span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs font-black text-amber-600 font-mono">
                                +{record.late_minutes}m
                              </span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {hasDeduction ? (
                                <span className="bg-red-500/10 text-red-600 border border-red-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">
                                  -{record.deduction_applied} Day
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs font-bold font-mono">—</span>
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
                                          ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                                          : "bg-surface-alt text-text-secondary border-border hover:bg-border/30"
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
    </div>
  );
}
