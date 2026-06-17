import React from 'react';
import { PresenceStats } from '@/types/presence';
import { Activity, Coffee, Moon, ShieldAlert, Monitor } from 'lucide-react';
import Card from '@/components/ui/Card';

interface PresenceKPIsProps {
  stats: PresenceStats;
}

export default function PresenceKPIs({ stats }: PresenceKPIsProps) {
  const kpis = [
    {
      title: 'Live Presence',
      value: `${stats.livePercentage.toFixed(0)}%`,
      subText: `${stats.online} of ${stats.total} online`,
      icon: Activity,
      iconColor: 'text-primary-600',
      iconBg: 'bg-primary-50',
      borderColor: 'border-t-primary-500'
    },
    {
      title: 'Working',
      value: stats.working,
      subText: 'Active within 5m',
      icon: Monitor,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      borderColor: 'border-t-emerald-500'
    },
    {
      title: 'On Break',
      value: stats.break,
      subText: 'Manual break mode',
      icon: Coffee,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      borderColor: 'border-t-amber-500'
    },
    {
      title: 'Idle',
      value: stats.idle,
      subText: 'No activity 5m+',
      icon: Moon,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
      borderColor: 'border-t-orange-500'
    },
    {
      title: 'Offline',
      value: stats.offline,
      subText: 'No heartbeat 90s+',
      icon: ShieldAlert,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      borderColor: 'border-t-red-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <Card 
            key={index} 
            hover={true} 
            className={`p-5 rounded-xl border border-zinc-200 border-t-3 ${kpi.borderColor} bg-white shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-xs`}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  {kpi.title}
                </span>
                <span className="text-2xl font-extrabold text-navy-900 leading-none block">
                  {kpi.value}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium block">
                  {kpi.subText}
                </span>
              </div>
              <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center shrink-0`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
