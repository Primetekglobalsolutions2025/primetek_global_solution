'use client';

import { useState, useMemo } from 'react';
import { Search, Download, FileSpreadsheet, Loader2, User, Clock, Calendar, MapPin, Sparkles } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { exportAttendanceExcel } from './actions';
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
}

const statusColors: Record<string, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  absent: 'bg-red-500/10 text-red-600 border-red-500/20',
  'half-day': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'pending wfh': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'approved wfh': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  'rejected wfh': 'bg-red-500/10 text-red-700 border-red-500/30',
};

export default function AttendanceClient({
  initialAttendance,
  employees
}: {
  initialAttendance: AttendanceRecord[],
  employees: { id: string, name: string }[]
}) {
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    return initialAttendance.filter((r) => {
      const matchesSearch = !search || r.employee_name.toLowerCase().includes(search.toLowerCase());
      const matchesEmployee = employeeFilter === 'all' || r.employee_id === employeeFilter;
      const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesEmployee && matchesStatus;
    });
  }, [initialAttendance, search, employeeFilter, statusFilter]);

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
    <div className="space-y-8">
      {/* 1. Filters & Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Filter by name..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border/60 bg-white text-sm text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" 
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={employeeFilter} 
              onChange={(e) => setEmployeeFilter(e.target.value)} 
              className="pl-4 pr-10 py-3 rounded-2xl border border-border/60 bg-white text-[10px] font-black uppercase tracking-widest text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none cursor-pointer shadow-sm min-w-[140px]"
            >
              <option value="all">Personnel: ALL</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
            </select>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)} 
              className="pl-4 pr-10 py-3 rounded-2xl border border-border/60 bg-white text-[10px] font-black uppercase tracking-widest text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none cursor-pointer shadow-sm min-w-[140px]"
            >
              <option value="all">Status: ALL</option>
              <option value="Present">PRESENT</option>
              <option value="Late">LATE</option>
              <option value="Absent">ABSENT</option>
              <option value="Pending WFH">WFH PENDING</option>
              <option value="Approved WFH">WFH APPROVED</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={exportCsv} 
            className="rounded-2xl border-border/60 font-bold px-6 py-3 h-auto active:scale-95 transition-all shadow-sm bg-white"
          >
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button 
            onClick={exportExcel} 
            disabled={isExporting} 
            className="rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black px-6 py-3 h-auto active:scale-95 transition-all shadow-xl shadow-teal-500/20"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Excel Master
          </Button>
        </div>
      </div>

      {/* 2. Overview Stats */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
            <span className="text-navy-900">{filtered.length}</span> entries synchronized
          </p>
        </div>
      </div>

      {/* 3. Table */}
      <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-[2rem] shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Staff Member</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Timeline</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Clock In</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Clock Out</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Intensity</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-sm text-text-muted font-bold">No synchronization logs found for this period.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((record) => (
                  <tr key={record.id} className="group hover:bg-surface-alt/30 transition-colors">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center text-navy-900 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-black text-navy-900 tracking-tight">{record.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-[11px] font-bold text-text-secondary">
                        {!isNaN(new Date(record.date).getTime()) 
                          ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase() 
                          : record.date?.toUpperCase() || '—'}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-navy-900">
                        <Clock className="w-3.5 h-3.5 text-emerald-500/50" />
                        {record.check_in || '—'}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-navy-900">
                        <Clock className="w-3.5 h-3.5 text-red-500/50" />
                        {record.check_out || '—'}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-xs font-black text-text-secondary">
                        {record.duration_hours > 0 ? (
                          <span className="bg-surface-alt px-2 py-1 rounded-lg border border-border/50">
                            {record.duration_hours}H
                          </span>
                        ) : '—'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={cn(
                        "inline-flex px-3 py-1 rounded-full text-[9px] font-black tracking-widest border uppercase",
                        statusColors[record.status?.toLowerCase()] || statusColors.present
                      )}>
                        {record.status}
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
  );
}
