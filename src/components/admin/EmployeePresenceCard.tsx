import React, { useEffect, useState } from 'react';
import { EmployeePresence } from '@/types/presence';
import { Monitor, Moon, Coffee, ShieldOff, Clock, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import Card from '@/components/ui/Card';

interface EmployeePresenceCardProps {
  presence: EmployeePresence;
}

export default function EmployeePresenceCard({ presence }: EmployeePresenceCardProps) {
  const [now, setNow] = useState(Date.now());

  // Run a local interval to update relative timestamps every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const getRelativeTimeString = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const dateMs = new Date(isoString).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - dateMs) / 1000));

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ${diffMinutes % 60}m ago`;
  };

  const getDurationString = (isoString: string | null) => {
    if (!isoString) return '0m';
    const dateMs = new Date(isoString).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - dateMs) / 1000));
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}h ${diffMinutes % 60}m`;
  };

  const statusConfig = {
    working: {
      label: 'Working',
      icon: Monitor,
      badgeClass: 'bg-emerald-50 border-emerald-500/30 text-emerald-700',
      dotClass: 'bg-emerald-500 animate-pulse',
      borderColor: 'border-t-emerald-500'
    },
    idle: {
      label: 'Idle',
      icon: Moon,
      badgeClass: 'bg-orange-50 border-orange-500/30 text-orange-700',
      dotClass: 'bg-orange-500',
      borderColor: 'border-t-orange-500'
    },
    break: {
      label: 'Break',
      icon: Coffee,
      badgeClass: 'bg-amber-50 border-amber-500/30 text-amber-700',
      dotClass: 'bg-amber-500 animate-pulse',
      borderColor: 'border-t-amber-500'
    },
    offline: {
      label: 'Offline',
      icon: ShieldOff,
      badgeClass: 'bg-red-50 border-red-500/30 text-red-700',
      dotClass: 'bg-red-500',
      borderColor: 'border-t-red-500'
    }
  };

  const currentStatus = presence.status || 'offline';
  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  const empName = presence.employees?.name || 'Unknown Employee';
  const empRole = presence.employees?.role || 'Employee';
  const empDept = presence.employees?.department || 'Operations';

  return (
    <Card 
      hover={true} 
      className={cn(
        "p-5 rounded-xl border border-zinc-200 border-t-3 bg-white shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-xs flex flex-col justify-between h-48",
        config.borderColor
      )}
    >
      {/* Header Info */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-navy-900 truncate tracking-tight">{empName}</h4>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">
            {empRole} • {empDept}
          </p>
        </div>
        
        {/* Status Badge */}
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider select-none shrink-0",
          config.badgeClass
        )}>
          <Icon className="w-3 h-3 shrink-0" />
          {config.label}
        </span>
      </div>

      {/* Analytics details */}
      <div className="space-y-2 py-3 border-t border-b border-zinc-100 my-2 text-xs font-semibold text-zinc-600">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 font-medium flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Last Active:</span>
          <span className="font-mono text-navy-900">
            {currentStatus === 'offline' ? 'Offline' : getRelativeTimeString(presence.last_activity)}
          </span>
        </div>
        
        {currentStatus === 'break' && presence.break_started_at && (
          <div className="flex justify-between items-center text-amber-600">
            <span className="font-medium flex items-center gap-1"><Coffee className="w-3.5 h-3.5" /> On Break:</span>
            <span className="font-mono">{getDurationString(presence.break_started_at)}</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mt-auto">
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-zinc-300" />
          Last Ping: {getRelativeTimeString(presence.last_heartbeat)}
        </span>
      </div>
    </Card>
  );
}
