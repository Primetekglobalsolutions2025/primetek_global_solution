'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  ExternalLink, 
  Briefcase, 
  Clock, 
  User, 
  Filter, 
  X, 
  RefreshCw, 
  Building2, 
  CheckCircle,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  Globe,
  ChevronRight
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
  jobTitle: string;
  url: string;
  type: string;
}

const ITEMS_PER_PAGE = 25;

export default function JobTrackerClient() {
  const [data, setData] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'linkedin' | 'upwork' | 'indeed' | 'other'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
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
  }, [search, selectedTab, selectedEmployee]);

  // Fetch job applications
  const fetchApplications = async (showToast = false) => {
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
        setData(resData.data || []);
        if (showToast) {
          toast.success('Successfully refreshed job applications.');
        }
      } else {
        throw new Error(resData.error || 'Failed to retrieve applications from Google Sheets.');
      }
    } catch (err: any) {
      console.error('[Job Tracker Fetch] Error:', err);
      setError(err?.message || 'Failed to fetch job tracker data. Make sure Google Sheet integration is configured.');
      if (showToast) {
        toast.error('Failed to refresh data: ' + (err?.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Compute list of unique employees for filter dropdown
  const uniqueEmployees = useMemo(() => {
    const names = data.map(item => item.employeeName).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [data]);

  // Filter application rows
  const filteredData = useMemo(() => {
    return data.filter((app) => {
      // 1. Search Query
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || 
        (app.employeeName || '').toLowerCase().includes(q) ||
        (app.jobTitle || '').toLowerCase().includes(q) ||
        (app.clientName || '').toLowerCase().includes(q) ||
        (app.type || '').toLowerCase().includes(q);

      // 2. Employee Dropdown Filter
      const matchesEmployee = selectedEmployee === 'all' || app.employeeName === selectedEmployee;

      // 3. Platform Tabs Filter
      let matchesPlatform = false;
      const typeLower = (app.type || '').toLowerCase().trim();
      if (selectedTab === 'all') {
        matchesPlatform = true;
      } else if (selectedTab === 'linkedin') {
        matchesPlatform = typeLower.includes('linkedin');
      } else if (selectedTab === 'upwork') {
        matchesPlatform = typeLower.includes('upwork');
      } else if (selectedTab === 'indeed') {
        matchesPlatform = typeLower.includes('indeed');
      } else {
        // 'other' option matches anything not in the main three platforms
        matchesPlatform = !typeLower.includes('linkedin') && 
                          !typeLower.includes('upwork') && 
                          !typeLower.includes('indeed');
      }

      return matchesSearch && matchesEmployee && matchesPlatform;
    });
  }, [data, search, selectedEmployee, selectedTab]);

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
        const appDateStr = new Date(app.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        return appDateStr === todayStr;
      } catch {
        return false;
      }
    }).length;

    const linkedin = data.filter(app => (app.type || '').toLowerCase().includes('linkedin')).length;
    const upwork = data.filter(app => (app.type || '').toLowerCase().includes('upwork')).length;
    const indeed = data.filter(app => (app.type || '').toLowerCase().includes('indeed')).length;
    const other = total - (linkedin + upwork + indeed);

    return { total, todayCount, linkedin, upwork, indeed, other };
  }, [data]);

  // Utility to style platform badges
  const getPlatformBadge = (type: string) => {
    const t = (type || '').toLowerCase().trim();
    if (t.includes('linkedin')) {
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
        label: 'LinkedIn'
      };
    }
    if (t.includes('upwork')) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
        label: 'Upwork'
      };
    }
    if (t.includes('indeed')) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800/30',
        label: 'Indeed'
      };
    }
    return {
      bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/10 dark:text-slate-400 dark:border-slate-800/30',
      label: type || 'Other'
    };
  };

  // Helper to format date & time nicely in IST timezone
  const formatDateTimeIST = (timestampStr: string): { date: string; time: string } => {
    if (!timestampStr) return { date: 'N/A', time: '' };
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {[
          { label: 'Total Logs', value: stats.total, icon: FileSpreadsheet, color: 'text-navy-900', bg: 'bg-white border-zinc-200/80 shadow-2xs' },
          { label: 'Today (IST)', value: stats.todayCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/5 border-amber-500/15 shadow-2xs', pulse: stats.todayCount > 0 },
          { label: 'LinkedIn', value: stats.linkedin, icon: Globe, color: 'text-blue-600', bg: 'bg-blue-500/5 border-blue-500/15 shadow-2xs' },
          { label: 'Upwork', value: stats.upwork, icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-500/5 border-emerald-500/15 shadow-2xs' },
          { label: 'Indeed / Other', value: stats.indeed + stats.other, icon: Layers, color: 'text-orange-600', bg: 'bg-orange-500/5 border-orange-500/15 shadow-2xs' },
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
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mt-1 font-sans">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Advanced Filtering Controls ─── */}
      <div className="space-y-4">
        {/* Search Engine Look */}
        <div className="flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search by Employee, Client Name, Job Title or Platform..." 
              value={searchValue} 
              onChange={(e) => setSearchValue(e.target.value)} 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200/80 bg-white text-xs text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/55 focus:border-primary-500 transition-all font-sans"
            />
            {searchValue && (
              <button 
                onClick={() => setSearchValue('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-zinc-450 text-xs shrink-0 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Employee:</span>
            </div>
            <select 
              value={selectedEmployee} 
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-250 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer transition-all"
            >
              <option value="all">All Employees</option>
              {uniqueEmployees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>

            <Button 
              onClick={() => fetchApplications(true)} 
              disabled={refreshing}
              variant="outline" 
              size="sm" 
              className="px-2.5 py-2 border-zinc-250 text-navy-900 rounded-lg hover:bg-zinc-50 shrink-0 font-semibold"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Platform Tabs & Total Count Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200/60 pb-1.5 gap-3">
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'All Platforms' },
              { id: 'linkedin', label: 'LinkedIn' },
              { id: 'upwork', label: 'Upwork' },
              { id: 'indeed', label: 'Indeed' },
              { id: 'other', label: 'Other / Generic' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative cursor-pointer',
                  selectedTab === tab.id
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-wider select-none shrink-0 sm:text-right">
            Showing {filteredData.length} records
          </div>
        </div>
      </div>

      {/* ─── Mobile Application Cards (hidden on desktop) ─── */}
      <div className="block md:hidden space-y-3.5">
        {filteredData.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-zinc-200/80">
            <p className="text-xs text-zinc-400 font-semibold">No applications matches current filters.</p>
          </div>
        ) : (
          paginatedData.map((app, idx) => {
            const platform = getPlatformBadge(app.type);
            const istDT = formatDateTimeIST(app.timestamp);
            return (
              <Card key={`${app.timestamp}-${idx}`} hover={false} className="p-4 rounded-xl border border-zinc-200/60 shadow-2xs bg-white space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm shrink-0 border border-zinc-700/10">
                      {renderInitials(app.employeeName)}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-navy-900 leading-tight">{app.employeeName}</h4>
                      <p className="text-[9px] font-bold text-zinc-450 font-mono mt-0.5">
                        {istDT.time ? `${istDT.date} @ ${istDT.time}` : istDT.date}
                      </p>
                    </div>
                  </div>
                  <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider', platform.bg)}>
                    {platform.label}
                  </span>
                </div>

                <div className="bg-zinc-50 p-2.5 rounded-lg text-[11px] space-y-1.5 border border-zinc-150/40">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider shrink-0 mt-0.5">Title</span>
                    <span className="font-extrabold text-navy-900 text-right truncate max-w-[200px]">{app.jobTitle || 'N/A'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-t border-zinc-150/30 pt-1.5">
                    <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider shrink-0 mt-0.5">Company</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-navy-900 text-right truncate max-w-[150px]">{app.clientName || 'N/A'}</span>
                      {app.url && (
                        <a 
                          href={app.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="Open Application Link" 
                          className="p-1 rounded-md text-primary-500 hover:bg-primary-100 transition-colors shrink-0 active:scale-90"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={() => setSelectedApp(app)}
                    className="text-xs text-primary-500 hover:text-primary-600 font-extrabold flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ─── Desktop Application Table (hidden on mobile) ─── */}
      <Card hover={false} className="p-0 overflow-hidden border border-zinc-200/80 rounded-xl shadow-2xs bg-white hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[160px]">Timestamp (IST)</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Employee</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Job Title</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Company / Client</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[120px]">Platform</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-zinc-400 text-xs font-semibold">
                    No applications matched the current filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((app, idx) => {
                  const platform = getPlatformBadge(app.type);
                  const istDT = formatDateTimeIST(app.timestamp);
                  return (
                    <tr key={`${app.timestamp}-${idx}`} className="hover:bg-zinc-50/50 transition-colors group">
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap font-mono border-r border-zinc-150/30">
                        {typeof istDT === 'object' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-navy-900">{istDT.date}</span>
                            <span className="text-zinc-400 font-medium text-[9px]">{istDT.time}</span>
                          </div>
                        ) : (
                          <span>{istDT}</span>
                        )}
                      </td>
                      
                      {/* Employee name with circular initials */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-navy-800 text-white flex items-center justify-center text-[9px] font-black shadow-2xs shrink-0 border border-zinc-650/15">
                            {renderInitials(app.employeeName)}
                          </div>
                          <span className="text-xs font-extrabold text-navy-900 leading-none truncate max-w-[150px]" title={app.employeeName}>
                            {app.employeeName}
                          </span>
                        </div>
                      </td>

                      {/* Job Title */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30">
                        <p className="text-xs font-extrabold text-navy-900 truncate max-w-[220px]" title={app.jobTitle}>
                          {app.jobTitle || 'N/A'}
                        </p>
                      </td>

                      {/* Client / Company & Apply Link Button */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-navy-900 truncate max-w-[180px]" title={app.clientName}>
                            {app.clientName || 'N/A'}
                          </span>
                          {app.url && (
                            <a 
                              href={app.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              title="Open source application url in a new tab"
                              className="p-1 rounded-md text-primary-500 hover:bg-primary-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-105 active:scale-95 shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Platform Badge */}
                      <td className="px-5 py-3.5 border-r border-zinc-150/30">
                        <span className={cn('inline-block text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider text-center w-full max-w-[90px] leading-tight', platform.bg)}>
                          {platform.label}
                        </span>
                      </td>

                      {/* Action trigger details */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="text-xs text-primary-500 hover:text-primary-650 font-extrabold flex items-center gap-0.5 active:scale-95 transition-transform"
                        >
                          View Details
                        </button>
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
                  <h2 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider">Application details</h2>
                </div>
                <button 
                  onClick={() => setSelectedApp(null)} 
                  className="p-1.5 rounded-lg hover:bg-zinc-150 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer active:scale-95"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 flex-1">
                
                {/* Employee Card */}
                <div className="pb-5 border-b border-zinc-150/50">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">Submitted By</span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center text-white text-xs font-black shadow-md border border-zinc-700/10">
                      {renderInitials(selectedApp.employeeName)}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-navy-900 leading-tight">{selectedApp.employeeName}</p>
                      <p className="text-[10px] text-zinc-450 font-bold font-mono mt-0.5">
                        Timestamp: {formatDateTimeIST(selectedApp.timestamp).date} @ {formatDateTimeIST(selectedApp.timestamp).time}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Job Details Card */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Job Title</span>
                    <p className="text-sm font-extrabold text-navy-900 bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl leading-relaxed">
                      {selectedApp.jobTitle || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Client / Company Name</span>
                    <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-navy-900">{selectedApp.clientName || 'N/A'}</span>
                      <Building2 className="w-4 h-4 text-zinc-450 shrink-0" />
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Job Board Platform</span>
                    <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex items-center justify-between">
                      <span className={cn('inline-block text-[9px] font-black px-2.5 py-0.5 rounded-lg border uppercase tracking-wider', getPlatformBadge(selectedApp.type).bg)}>
                        {getPlatformBadge(selectedApp.type).label}
                      </span>
                    </div>
                  </div>

                  {selectedApp.url && (
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Application URL</span>
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
                          <span>Open Live Job Post</span>
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
