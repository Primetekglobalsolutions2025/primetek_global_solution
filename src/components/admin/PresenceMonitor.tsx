'use client';

import React, { useState, useMemo } from 'react';
import { usePresenceSubscription } from '@/hooks/usePresenceSubscription';
import PresenceKPIs from './PresenceKPIs';
import EmployeePresenceCard from './EmployeePresenceCard';
import { Search, Loader2, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import Button from '@/components/ui/Button';

interface PresenceMonitorProps {
  token: string;
}

export default function PresenceMonitor({ token }: PresenceMonitorProps) {
  const {
    presenceList,
    connectionStatus,
    loading,
    refresh
  } = usePresenceSubscription(token);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  // Compute live statistics dynamically
  const stats = useMemo(() => {
    const total = presenceList.length;
    const working = presenceList.filter(p => p.status === 'working').length;
    const idle = presenceList.filter(p => p.status === 'idle').length;
    const brk = presenceList.filter(p => p.status === 'break').length;
    const offline = presenceList.filter(p => p.status === 'offline').length;
    const online = total - offline;
    const livePercentage = total > 0 ? (online / total) * 100 : 0;

    return {
      total,
      online,
      working,
      break: brk,
      idle,
      offline,
      livePercentage
    };
  }, [presenceList]);

  // Filter and sort the presence list
  const processedList = useMemo(() => {
    let result = [...presenceList];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(p => 
        (p.employees?.name || '').toLowerCase().includes(term) ||
        (p.employees?.role || '').toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.employees?.name || '';
        const nameB = b.employees?.name || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'status') {
        const statusA = a.status || 'offline';
        const statusB = b.status || 'offline';
        return statusA.localeCompare(statusB);
      }
      if (sortBy === 'last_activity') {
        const timeA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
        const timeB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        // Most recent activity first
        return timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [presenceList, searchTerm, filterStatus, sortBy]);

  // Connection indicator styles
  const connectionStyles = {
    connected: {
      text: 'Live Sync Active',
      colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200/50',
      icon: Wifi
    },
    connecting: {
      text: 'Reconnecting...',
      colorClass: 'text-amber-600 bg-amber-50 border-amber-200/50 animate-pulse',
      icon: Loader2
    },
    disconnected: {
      text: 'Sync Offline',
      colorClass: 'text-red-600 bg-red-50 border-red-200/50',
      icon: WifiOff
    }
  };

  const currentConnection = connectionStyles[connectionStatus];
  const ConnectionIcon = currentConnection.icon;

  return (
    <div className="space-y-6">
      {/* Header and Sync Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-navy-900 tracking-tight flex items-center gap-2">
            <span>Presence Monitoring Console</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${currentConnection.colorClass}`}>
              <ConnectionIcon className={`w-3 h-3 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
              {currentConnection.text}
            </span>
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1 font-medium">
            Shows active status of clocked-in employees. Status transitions are computed in real time.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refresh}
            disabled={loading}
            className="text-xs font-semibold py-2 px-3 hover:bg-zinc-50 border-zinc-200 shadow-2xs cursor-pointer active:scale-98 transition-all shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh List
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <PresenceKPIs stats={stats} />

      {/* Search, Filter and Sort Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search employees by name or role..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 hover:border-zinc-300 transition-all text-xs font-semibold shadow-2xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 hover:border-zinc-300 transition-all cursor-pointer shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="working">🟢 Working</option>
              <option value="idle">🟠 Idle</option>
              <option value="break">🟡 On Break</option>
              <option value="offline">🔴 Offline</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 hover:border-zinc-300 transition-all cursor-pointer shadow-2xs"
            >
              <option value="name">Alphabetical</option>
              <option value="status">Presence Status</option>
              <option value="last_activity">Recent Activity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Cards */}
      {processedList.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-16 text-center shadow-2xs">
          <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-navy-900">No active records found</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            {searchTerm || filterStatus !== 'all' 
              ? 'No employees match your active filters. Try refining your search query.' 
              : 'There are no active or registered employees linked to your workspace.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {processedList.map((presence) => (
            <EmployeePresenceCard 
              key={presence.employee_id} 
              presence={presence} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
