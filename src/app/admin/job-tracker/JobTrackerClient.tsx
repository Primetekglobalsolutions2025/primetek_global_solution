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
  Users,
  Layers,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

import dynamic from 'next/dynamic';

const UniverSheetEditor = dynamic(() => import('@/components/admin/UniverSheetEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Loading Sheet Editor...</p>
    </div>
  )
});

interface JobApplication {
  employeeName: string;
  timestamp: string;
  clientName: string;
  jobRole: string;
  url: string;
  claimedBy?: string;
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
  const [selectedTab, setSelectedTab] = useState<'all' | 'shared' | 'solo'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  // UniverJS Integration States
  const [viewMode, setViewMode] = useState<'dashboard' | 'spreadsheet'>('dashboard');
  const [univerData, setUniverData] = useState<any>(null);
  const [univerLoading, setUniverLoading] = useState(false);
  const [savingUniver, setSavingUniver] = useState(false);
  
  const { toast } = useToast();
  const drawerRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(drawerRef, !!selectedApp, () => setSelectedApp(null));

  const fetchUniverData = async () => {
    try {
      setUniverLoading(true);
      const res = await fetch('/api/admin/job-tracker/univer-load');
      if (!res.ok) throw new Error('Failed to load sheet data');
      const result = await res.json();
      if (result.success) {
        setUniverData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error('Failed to load spreadsheet: ' + err.message);
    } finally {
      setUniverLoading(false);
    }
  };

  const saveUniverData = async (content: any) => {
    try {
      setSavingUniver(true);
      const res = await fetch('/api/admin/job-tracker/univer-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to save sheet data');
      const result = await res.json();
      if (result.success) {
        toast.success('Spreadsheet saved successfully!');
        fetchApplications(); // Sync main dashboard stats
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error('Failed to save spreadsheet: ' + err.message);
    } finally {
      setSavingUniver(false);
    }
  };

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
        // Map keys if the sheet returned old format key names
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

  // Load sheet data on spreadsheet view switch
  useEffect(() => {
    if (viewMode === 'spreadsheet' && !univerData) {
      fetchUniverData();
    }
  }, [viewMode, univerData]);

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
        (app.jobRole || '').toLowerCase().includes(q) ||
        (app.clientName || '').toLowerCase().includes(q) ||
        (app.claimedBy || '').toLowerCase().includes(q);

      // 2. Employee Dropdown Filter
      const matchesEmployee = selectedEmployee === 'all' || app.employeeName === selectedEmployee;

      // 3. Claim Sharing Filter
      let matchesClaims = true;
      const claimers = (app.claimedBy || app.employeeName).split(',').map(n => n.trim()).filter(Boolean);
      if (selectedTab === 'shared') {
        matchesClaims = claimers.length > 1;
      } else if (selectedTab === 'solo') {
        matchesClaims = claimers.length === 1;
      }

      return matchesSearch && matchesEmployee && matchesClaims;
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
        // Check if date is short "04-Jun" or ISO
        if (app.timestamp.match(/^\d{2}-[A-Za-z]{3}$/)) {
          // Compare with today formatted as "dd-MMM"
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

    const uniqueRoles = new Set(data.map(app => app.jobRole?.toLowerCase().trim()).filter(Boolean)).size;
    const uniqueClients = new Set(data.map(app => app.clientName?.toLowerCase().trim()).filter(Boolean)).size;
    const sharedLeads = data.filter(app => {
      const claimers = (app.claimedBy || '').split(',').map(n => n.trim()).filter(Boolean);
      return claimers.length > 1;
    }).length;

    return { total, todayCount, uniqueRoles, uniqueClients, sharedLeads };
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
      {/* View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-zinc-250 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-2 rounded-lg border",
            viewMode === 'dashboard' ? "bg-navy-900 text-white border-navy-950" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}>
            {viewMode === 'dashboard' ? <Layers className="w-4.5 h-4.5" /> : <FileSpreadsheet className="w-4.5 h-4.5" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-900 leading-none">
              {viewMode === 'dashboard' ? 'Job Applications Dashboard' : 'Interactive Spreadsheet Editor'}
            </h2>
            <p className="text-[10px] text-zinc-400 font-medium mt-1">
              {viewMode === 'dashboard' 
                ? 'Overview of employee application statistics, claimed roles, and live filters.' 
                : 'Directly modify the spreadsheet database state using UniverJS engine.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'dashboard'
                ? "bg-navy-900 text-white shadow-sm"
                : "bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100"
            )}
          >
            Dashboard View
          </button>
          <button
            onClick={() => setViewMode('spreadsheet')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === 'spreadsheet'
                ? "bg-navy-900 text-white shadow-sm"
                : "bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Spreadsheet Editor
          </button>
        </div>
      </div>

      {viewMode === 'spreadsheet' ? (
        <div className="space-y-4">
          {/* Spreadsheet Actions Toolbar */}
          <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-navy-900">Spreadsheet Actions:</span>
              <span className="text-[10px] text-zinc-550 font-medium font-sans">
                Changes must be saved to persist to the database.
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => fetchUniverData()}
                disabled={univerLoading || savingUniver}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 bg-white border-zinc-200 text-navy-900 hover:bg-zinc-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", univerLoading && "animate-spin")} />
                Reload Data
              </Button>
              <Button
                onClick={() => {
                  if (typeof (window as any).__univerSaveHandler === 'function') {
                    (window as any).__univerSaveHandler();
                  } else {
                    toast.error('Univer editor is not fully initialized');
                  }
                }}
                disabled={univerLoading || savingUniver}
                size="sm"
                className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
              >
                {savingUniver ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>

          {univerLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 bg-white border border-zinc-200 rounded-xl">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Fetching Sheet Data...</p>
            </div>
          ) : univerData ? (
            <UniverSheetEditor 
              initialData={univerData} 
              onSave={saveUniverData} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 bg-white border border-zinc-200 rounded-xl p-8">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-zinc-800 text-sm font-bold">Failed to load spreadsheet configuration.</p>
              <p className="text-zinc-500 text-xs text-center max-w-md mt-1">
                Make sure that the database table `job_tracker_sheets` has been created and initialized.
              </p>
              <Button onClick={() => fetchUniverData()} size="sm" className="mt-4">
                Retry Loading
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ─── Metrics / Operational KPIs ─── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {[
              { label: 'Total Leads', value: stats.total, icon: FileSpreadsheet, color: 'text-navy-900', bg: 'bg-white border-zinc-200/80 shadow-2xs' },
              { label: 'Added Today', value: stats.todayCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/5 border-amber-500/15 shadow-2xs', pulse: stats.todayCount > 0 },
              { label: 'Unique Roles', value: stats.uniqueRoles, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-500/5 border-blue-500/15 shadow-2xs' },
              { label: 'Active Clients', value: stats.uniqueClients, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-500/5 border-emerald-500/15 shadow-2xs' },
              { label: 'Shared Leads', value: stats.sharedLeads, icon: Users, color: 'text-orange-600', bg: 'bg-orange-500/5 border-orange-500/15 shadow-2xs' },
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
            <div className="flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Search by Employee, Client Name, Job Role or Claimer..." 
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
                  className="px-3 py-2 rounded-lg border border-zinc-255 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer transition-all"
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

            {/* Claim Filter Tabs & Total Count Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200/60 pb-1.5 gap-3">
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
                <p className="text-xs text-zinc-400 font-semibold">No applications matched the current filters.</p>
              </div>
            ) : (
              paginatedData.map((app, idx) => {
                const istDT = formatDateTimeIST(app.timestamp);
                const claimers = (app.claimedBy || app.employeeName).split(',').map(n => n.trim()).filter(Boolean);
                return (
                  <Card key={`${app.timestamp}-${idx}`} hover={false} className="p-4 rounded-xl border border-zinc-200/60 shadow-2xs bg-white space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm shrink-0 border border-zinc-700/10">
                          {renderInitials(app.employeeName)}
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-navy-900 leading-none">{app.employeeName}</h4>
                          <p className="text-[9px] font-bold text-zinc-450 font-mono mt-0.5">
                            {istDT.date}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-50 p-2.5 rounded-lg text-[11px] space-y-1.5 border border-zinc-150/40">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider shrink-0 mt-0.5">Job Role</span>
                        <span className="font-extrabold text-navy-900 text-right truncate max-w-[200px]">{app.jobRole || 'N/A'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2 border-t border-zinc-150/30 pt-1.5">
                        <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider shrink-0 mt-0.5">Client</span>
                        <span className="font-bold text-navy-900 text-right truncate max-w-[150px]">{app.clientName || 'N/A'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2 border-t border-zinc-150/30 pt-1.5">
                        <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider shrink-0 mt-0.5">Claims</span>
                        <div className="flex flex-wrap justify-end gap-1 max-w-[200px]">
                          {claimers.map(c => (
                            <span key={c} className="text-[8px] px-1 rounded font-mono bg-emerald-50 text-emerald-700 border border-emerald-250 uppercase font-medium">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {app.url && (
                        <a 
                          href={app.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] font-mono font-bold text-primary-500 hover:underline flex items-center gap-0.5"
                        >
                          Apply Link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="text-xs text-primary-500 hover:text-primary-600 font-extrabold flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* ─── Desktop Application Table (hidden on desktop) ─── */}
          <Card hover={false} className="p-0 overflow-hidden border border-zinc-200/80 rounded-xl shadow-2xs bg-white hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50">
                    <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[140px]">Date Logged</th>
                    <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[160px]">Submitter</th>
                    <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Job Role</th>
                    <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Client Name</th>
                    <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Claimed By (Lookup)</th>
                    <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 w-[160px]">Actions</th>
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
                      const istDT = formatDateTimeIST(app.timestamp);
                      const claimers = (app.claimedBy || app.employeeName).split(',').map(n => n.trim()).filter(Boolean);
                      return (
                        <tr key={`${app.timestamp}-${idx}`} className="hover:bg-zinc-50/50 transition-colors group">
                          {/* Timestamp / Date */}
                          <td className="px-5 py-3.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap font-mono border-r border-zinc-150/30">
                            {istDT.date}
                          </td>
                          
                          {/* Submitter */}
                          <td className="px-5 py-3.5 border-r border-zinc-150/30">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-navy-800 text-white flex items-center justify-center text-[9px] font-black shadow-2xs shrink-0 border border-zinc-650/15">
                                {renderInitials(app.employeeName)}
                              </div>
                              <span className="text-xs font-extrabold text-navy-900 leading-none truncate max-w-[120px]" title={app.employeeName}>
                                {app.employeeName}
                              </span>
                            </div>
                          </td>
     
                          {/* Job Role */}
                          <td className="px-5 py-3.5 border-r border-zinc-150/30">
                            <p className="text-xs font-extrabold text-navy-900 truncate max-w-[200px]" title={app.jobRole}>
                              {app.jobRole || 'N/A'}
                            </p>
                          </td>

                          {/* Client Name */}
                          <td className="px-5 py-3.5 border-r border-zinc-150/30">
                            <span className="text-xs font-bold text-navy-900 truncate max-w-[180px]" title={app.clientName}>
                              {app.clientName || 'N/A'}
                            </span>
                          </td>

                          {/* Claimed By Lookup list */}
                          <td className="px-5 py-3.5 border-r border-zinc-150/30">
                            <div className="flex flex-wrap gap-1.5">
                              {claimers.map(c => (
                                <span key={c} className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase tracking-wider">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Action trigger links */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {app.url && (
                                <a 
                                  href={app.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  title="Redirect to Application Page"
                                  className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-primary-500 hover:text-primary-650 uppercase tracking-wider bg-primary-50/40 border border-primary-200/30 px-2.5 py-0.5 rounded transition-all shrink-0 cursor-pointer"
                                >
                                  Apply 🔗
                                </a>
                              )}
                              <button
                                onClick={() => setSelectedApp(app)}
                                className="text-xs text-zinc-400 hover:text-zinc-600 font-extrabold active:scale-95 transition-transform"
                              >
                                Details
                              </button>
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
                      <h2 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider">Application details</h2>
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
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">Submitted By</span>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center text-white text-xs font-black shadow-md border border-zinc-700/10">
                          {renderInitials(selectedApp.employeeName)}
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-navy-900 leading-tight">{selectedApp.employeeName}</p>
                          <p className="text-[10px] text-zinc-450 font-bold font-mono mt-0.5">
                            Date: {formatDateTimeIST(selectedApp.timestamp).date}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Job Details Card */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Job Role</span>
                        <p className="text-sm font-extrabold text-navy-900 bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl leading-relaxed">
                          {selectedApp.jobRole || 'N/A'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Client Name</span>
                        <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex items-center justify-between">
                          <span className="text-sm font-bold text-navy-900">{selectedApp.clientName || 'N/A'}</span>
                          <Building2 className="w-4 h-4 text-zinc-450 shrink-0" />
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Claimed By</span>
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
        </>
      )}
    </div>
  );
}
