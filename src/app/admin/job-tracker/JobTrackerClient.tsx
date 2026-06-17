'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  ExternalLink, 
  Briefcase, 
  Clock, 
  X, 
  RefreshCw, 
  Building2, 
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  Users,
  ChevronRight,
  Calendar,
  FilterX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface JobApplication {
  employeeName: string;
  timestamp: string;
  clientName: string;
  jobRole: string;
  url: string;
  claimedBy?: string;
}

const ITEMS_PER_PAGE = 25;

// Helper to parse date string into Date object
const parseAppDate = (timestampStr: string): Date | null => {
  if (!timestampStr) return null;
  try {
    // If it's a short format like "04-Jun"
    if (timestampStr.match(/^\d{2}-[A-Za-z]{3}$/)) {
      const parts = timestampStr.split('-');
      const day = parseInt(parts[0], 10);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
      if (month === -1) return null;
      const year = new Date().getFullYear();
      return new Date(year, month, day, 0, 0, 0, 0);
    }
    const parsed = new Date(timestampStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

// Helper to determine if a date falls within preset/range
const isDateInPreset = (
  date: Date,
  preset: 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom',
  customStart?: string,
  customEnd?: string
): boolean => {
  if (preset === 'all') return true;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === 'today') {
    return date >= todayStart && date <= todayEnd;
  }

  if (preset === 'yesterday') {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    return date >= yesterdayStart && date <= yesterdayEnd;
  }

  if (preset === '7days') {
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return date >= sevenDaysAgo && date <= todayEnd;
  }

  if (preset === '30days') {
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date >= thirtyDaysAgo && date <= todayEnd;
  }

  if (preset === 'custom') {
    let startLimit = new Date(0);
    let endLimit = new Date(now.getFullYear() + 10, 11, 31);
    
    if (customStart) {
      const parsedStart = new Date(customStart);
      if (!isNaN(parsedStart.getTime())) {
        startLimit = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0);
      }
    }
    if (customEnd) {
      const parsedEnd = new Date(customEnd);
      if (!isNaN(parsedEnd.getTime())) {
        endLimit = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999);
      }
    }
    return date >= startLimit && date <= endLimit;
  }

  return true;
};

export default function JobTrackerClient() {
  const [data, setData] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'shared' | 'solo'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const { toast } = useToast();
  const drawerRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(drawerRef, !!selectedApp, () => setSelectedApp(null));

  // Search debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchValue);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchValue]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedTab, selectedEmployee, selectedRole, dateFilterType, startDate, endDate]);

  // Fetch job applications
  const fetchApplications = useCallback(async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/job-tracker');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const resData = await res.json();
      if (resData.success) {
        const rawData = resData.data || [];
        const formatted = rawData.map((item: any) => ({
          employeeName: item.employeeName || '',
          timestamp: item.timestamp || '',
          clientName: item.clientName || item.companyName || '',
          jobRole: item.jobRole || item.jobTitle || '',
          url: item.url || item.applicationUrl || '',
          claimedBy: item.claimedBy || ''
        }));
        setData(formatted);
        if (showToast) {
          toast.success('Successfully refreshed job applications.');
        }
      } else {
        throw new Error(resData.error || 'Failed to retrieve applications.');
      }
    } catch (err: any) {
      console.error('[Job Tracker Fetch] Error:', err);
      setError(err?.message || 'Failed to fetch job tracker data.');
      if (showToast) {
        toast.error('Failed to refresh data: ' + (err?.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Compute unique lists for filter dropdowns
  const uniqueEmployees = useMemo(() => {
    const names = data.map(item => item.employeeName).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [data]);

  const uniqueRoles = useMemo(() => {
    const roles = data.map(item => item.jobRole).filter(Boolean);
    return Array.from(new Set(roles)).sort();
  }, [data]);

  const hasActiveFilters = searchValue || selectedEmployee !== 'all' || selectedRole !== 'all' || dateFilterType !== 'all' || startDate || endDate;

  const handleResetFilters = () => {
    setSearchValue('');
    setSearch('');
    setSelectedEmployee('all');
    setSelectedRole('all');
    setDateFilterType('all');
    setStartDate('');
    setEndDate('');
  };

  // Filter application rows
  const filteredData = useMemo(() => {
    return data.filter((app) => {
      // 1. Search Query
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || 
        (app.employeeName || '').toLowerCase().includes(q) ||
        (app.jobRole || '').toLowerCase().includes(q) ||
        (app.clientName || '').toLowerCase().includes(q) ||
        (app.claimedBy || '').toLowerCase().includes(q);

      // 2. Employee filter
      const matchesEmployee = selectedEmployee === 'all' || app.employeeName === selectedEmployee;

      // 3. Job Role filter
      const matchesRole = selectedRole === 'all' || app.jobRole === selectedRole;

      // 4. Claim Sharing filter
      let matchesClaims = true;
      const claimers = (app.claimedBy || app.employeeName).split(',').map(n => n.trim()).filter(Boolean);
      if (selectedTab === 'shared') {
        matchesClaims = claimers.length > 1;
      } else if (selectedTab === 'solo') {
        matchesClaims = claimers.length === 1;
      }

      // 5. Date filter
      let matchesDate = true;
      if (dateFilterType !== 'all') {
        const appDate = parseAppDate(app.timestamp);
        if (appDate) {
          matchesDate = isDateInPreset(appDate, dateFilterType, startDate, endDate);
        } else {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesEmployee && matchesRole && matchesClaims && matchesDate;
    });
  }, [data, search, selectedEmployee, selectedRole, selectedTab, dateFilterType, startDate, endDate]);

  // Pagination helper calculations
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  }, [filteredData.length]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = data.length;
    
    // Count applications submitted today in IST
    const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const todayCount = data.filter(app => {
      try {
        if (!app.timestamp) return false;
        if (app.timestamp.match(/^\d{2}-[A-Za-z]{3}$/)) {
          const todayShort = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            timeZone: 'Asia/Kolkata'
          }).replace(' ', '-');
          return app.timestamp.toLowerCase() === todayShort.toLowerCase();
        }
        const appDateStr = new Date(app.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        return appDateStr === todayStr;
      } catch {
        return false;
      }
    }).length;

    const uniqueRolesCount = new Set(data.map(app => app.jobRole?.toLowerCase().trim()).filter(Boolean)).size;
    const uniqueClientsCount = new Set(data.map(app => app.clientName?.toLowerCase().trim()).filter(Boolean)).size;
    const sharedLeadsCount = data.filter(app => {
      const claimers = (app.claimedBy || '').split(',').map(n => n.trim()).filter(Boolean);
      return claimers.length > 1;
    }).length;

    return { total, todayCount, uniqueRoles: uniqueRolesCount, uniqueClients: uniqueClientsCount, sharedLeads: sharedLeadsCount };
  }, [data]);

  // Helper to format date & time nicely in IST timezone
  const formatDateTimeIST = (timestampStr: string): { date: string; time: string } => {
    if (!timestampStr) return { date: 'N/A', time: '' };
    if (timestampStr.match(/^\d{2}-[A-Za-z]{3}$/)) {
      return { date: timestampStr, time: '' };
    }
    try {
      const dateObj = new Date(timestampStr);
      if (isNaN(dateObj.getTime())) return { date: timestampStr, time: '' };
      
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      const formattedTime = dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      });
      return { date: formattedDate, time: formattedTime };
    } catch {
      return { date: timestampStr, time: '' };
    }
  };

  // Render employee profile circular initials avatar
  const renderInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Loading Sheet Records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card hover={false} className="p-8 border-red-200 bg-red-50/10 rounded-xl max-w-4xl mx-auto mt-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <h3 className="text-sm font-bold text-navy-900 leading-none">Connection Error</h3>
            <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
            <div className="pt-2">
              <Button size="sm" onClick={() => fetchApplications()} className="flex items-center gap-1.5 bg-navy-900 text-white rounded-lg hover:bg-navy-950">
                <RefreshCw className="w-3.5 h-3.5" /> Try Reconnecting
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Metrics / Operational KPIs ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, icon: FileSpreadsheet, color: 'text-navy-900', bg: 'bg-white border-zinc-200 shadow-sm' },
          { label: 'Added Today', value: stats.todayCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/5 border-amber-500/15 shadow-sm', pulse: stats.todayCount > 0 },
          { label: 'Unique Roles', value: stats.uniqueRoles, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-500/5 border-blue-500/15 shadow-sm' },
          { label: 'Active Clients', value: stats.uniqueClients, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-500/5 border-emerald-500/15 shadow-sm' },
          { label: 'Shared Leads', value: stats.sharedLeads, icon: Users, color: 'text-orange-600', bg: 'bg-orange-500/5 border-orange-500/15 shadow-sm' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl p-4 border flex items-center gap-3 bg-white', s.bg)}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border bg-white/70', s.color)}>
              <s.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-navy-900 leading-none">
                {s.value}
                {s.pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-1.5 align-middle" />}
              </p>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mt-1.5 font-sans">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Advanced Filtering Controls ─── */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Text Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-sans">Search Keyword</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search roles, clients, names..." 
                value={searchValue} 
                onChange={(e) => setSearchValue(e.target.value)} 
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-250 bg-white text-xs text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-sans"
              />
              {searchValue && (
                <button 
                  onClick={() => setSearchValue('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Employee Dropdown Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-sans">Employee Submitter</label>
            <div className="relative">
              <select 
                value={selectedEmployee} 
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-zinc-250 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 cursor-pointer transition-all"
              >
                <option value="all">All Employees</option>
                {uniqueEmployees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Job Role Dropdown Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-sans">Job Role Filter</label>
            <div className="relative">
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-zinc-250 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 cursor-pointer transition-all"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Date range presets filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-sans">Date Range Filter</label>
            <div className="relative">
              <select 
                value={dateFilterType} 
                onChange={(e) => setDateFilterType(e.target.value as any)}
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-zinc-250 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 cursor-pointer transition-all"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker inputs (conditionally shown) */}
        <AnimatePresence>
          {dateFilterType === 'custom' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-zinc-100 pt-4 flex flex-col sm:flex-row gap-4 items-end"
            >
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-sans">Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-250 bg-white text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-sans"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-sans">End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-250 bg-white text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-sans"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => { setStartDate(''); setEndDate(''); }} 
                  variant="outline" 
                  size="sm" 
                  className="border-zinc-250 text-zinc-650 hover:bg-zinc-50 py-1.5 px-3 rounded-lg text-xs"
                >
                  Clear Dates
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Claim Filter Tabs & Total Count Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200/60 pb-2 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'All Leads' },
              { id: 'shared', label: 'Shared Leads (>1 Claim)' },
              { id: 'solo', label: 'Solo Leads (1 Claim)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative cursor-pointer',
                  selectedTab === tab.id
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-zinc-400 hover:text-zinc-650 hover:underline flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Reset filters</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-wider select-none">
            Showing {filteredData.length} records
          </div>
          <Button 
            onClick={() => fetchApplications(true)} 
            disabled={refreshing}
            variant="outline" 
            size="sm" 
            className="px-2.5 py-1.5 border-zinc-250 text-navy-900 rounded-lg hover:bg-zinc-50 shrink-0 font-semibold"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ─── Redesigned Responsive Unified List View ─── */}
      <Card hover={false} className="p-0 overflow-hidden border border-zinc-200/80 rounded-xl shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="text-left px-5 py-3.5 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[140px] md:w-[160px]">Date Logged</th>
                <th className="text-left px-5 py-3.5 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[150px] md:w-[180px]">Submitter</th>
                <th className="text-left px-5 py-3.5 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Job Details</th>
                <th className="text-left px-5 py-3.5 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 hidden sm:table-cell">Claimed By (Lookup)</th>
                <th className="text-left px-5 py-3.5 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 w-[140px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-zinc-400 text-xs font-semibold bg-zinc-50/20">
                    No applications matched the current filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((app, idx) => {
                  const istDT = formatDateTimeIST(app.timestamp);
                  const claimers = (app.claimedBy || app.employeeName).split(',').map(n => n.trim()).filter(Boolean);
                  return (
                    <tr 
                      key={`${app.timestamp}-${idx}`} 
                      onClick={() => setSelectedApp(app)}
                      className="hover:bg-zinc-50/60 transition-all group cursor-pointer border-b border-zinc-100 last:border-0"
                    >
                      {/* Date Column */}
                      <td className="px-5 py-3.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap font-mono border-r border-zinc-150/30">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{istDT.date}</span>
                        </div>
                      </td>
                      
                      {/* Submitter Column */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-navy-800 text-white flex items-center justify-center text-[9px] font-black shadow-2xs shrink-0 border border-zinc-650/15">
                            {renderInitials(app.employeeName)}
                          </div>
                          <span className="text-xs font-extrabold text-navy-900 leading-none truncate max-w-[100px] md:max-w-[140px]" title={app.employeeName}>
                            {app.employeeName}
                          </span>
                        </div>
                      </td>

                      {/* Job Details Column (Adaptive stacking) */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30">
                        <div className="space-y-1 max-w-[250px] md:max-w-md">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-zinc-450 shrink-0" />
                            <p className="text-xs font-extrabold text-navy-900 truncate" title={app.jobRole}>
                              {app.jobRole || 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate" title={app.clientName}>{app.clientName || 'N/A'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Claimed By (Hidden on mobile) */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1.5 max-w-[200px] md:max-w-[300px]">
                          {claimers.map(c => (
                            <span key={c} className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase tracking-wider">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {app.url && (
                            <a 
                              href={app.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              title="Redirect to Application Page"
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-primary-500 hover:text-primary-650 uppercase tracking-wider bg-primary-50/40 border border-primary-200/30 px-2.5 py-1 rounded transition-all shrink-0 cursor-pointer"
                            >
                              Apply Link <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-655 transition-colors shrink-0" />
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

      {/* ─── Pagination Footer ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200/60">
          <div className="text-xs text-zinc-500 font-medium font-sans">
            Showing <span className="font-bold text-navy-900">{Math.min(filteredData.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to{' '}
            <span className="font-bold text-navy-900">{Math.min(filteredData.length, currentPage * ITEMS_PER_PAGE)}</span> of{' '}
            <span className="font-bold text-navy-900">{filteredData.length}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs rounded-lg border-zinc-250 text-navy-900 hover:bg-zinc-50"
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
                  variant={currentPage === pageNum ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-8 h-8 p-0 text-xs font-bold rounded-lg border-zinc-250",
                    currentPage === pageNum ? "bg-navy-900 text-white hover:bg-navy-950" : "text-navy-900 hover:bg-zinc-50"
                  )}
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
              className="px-3 py-1.5 text-xs rounded-lg border-zinc-250 text-navy-900 hover:bg-zinc-50"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ─── Detail Drawer (Slide-Over Panel) ─── */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-55 flex items-center justify-end bg-black/30 backdrop-blur-xs" onClick={() => setSelectedApp(null)}>
            <motion.div
              ref={drawerRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto flex flex-col border-l border-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center shadow-sm">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider font-sans">Application details</h2>
                </div>
                <button 
                  onClick={() => setSelectedApp(null)} 
                  className="p-1.5 rounded-lg hover:bg-zinc-150 text-zinc-450 hover:text-zinc-700 transition-colors cursor-pointer active:scale-95"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 flex-1 text-zinc-650">
                
                {/* Employee Card */}
                <div className="pb-5 border-b border-zinc-150/50">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5 font-sans">Submitted By</span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center text-white text-xs font-black shadow-md border border-zinc-700/10">
                      {renderInitials(selectedApp.employeeName)}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-navy-900 leading-tight">{selectedApp.employeeName}</p>
                      <p className="text-[10px] text-zinc-450 font-bold font-mono mt-0.5">
                        Date: {formatDateTimeIST(selectedApp.timestamp).date} {formatDateTimeIST(selectedApp.timestamp).time}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Job Details Card */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Job Role</span>
                    <p className="text-sm font-extrabold text-navy-900 bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl leading-relaxed">
                      {selectedApp.jobRole || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Client Name</span>
                    <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-navy-900">{selectedApp.clientName || 'N/A'}</span>
                      <Building2 className="w-4 h-4 text-zinc-450 shrink-0" />
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Claimed By</span>
                    <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex flex-wrap gap-1.5">
                      {(selectedApp.claimedBy || selectedApp.employeeName).split(',').map((c) => {
                        const tr = c.trim();
                        if (!tr) return null;
                        return (
                          <span key={tr} className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-250 uppercase tracking-wider">
                            {tr}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {selectedApp.url && (
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Application URL</span>
                      <div className="bg-zinc-50 border border-zinc-200/50 p-3.5 rounded-xl space-y-3">
                        <p className="text-[10px] text-zinc-550 break-all leading-normal select-all font-mono">
                          {selectedApp.url}
                        </p>
                        <a 
                          href={selectedApp.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-navy-900 hover:bg-navy-950 text-white rounded-lg font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Application URL</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
