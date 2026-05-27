'use client';

import { useState } from 'react';
import { Calendar, Plus, X, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Coffee, Hourglass, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LeaveRequestForm from '@/components/employee/LeaveRequestForm';
import { formatDate, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export interface LeaveRecord {
  id: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface LeaveBalance {
  leave_type: string;
  remaining_days: number;
}

export default function LeavesClient({
  initialLeaves,
  initialBalances
}: {
  initialLeaves: LeaveRecord[];
  initialBalances: LeaveBalance[];
}) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveRecord[]>(initialLeaves);
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances);
  const [isApplying, setIsApplying] = useState(false);

  // Sync props to state inline to avoid useEffect set-state-in-effect warning
  const [prevInitialLeaves, setPrevInitialLeaves] = useState(initialLeaves);
  if (initialLeaves !== prevInitialLeaves) {
    setPrevInitialLeaves(initialLeaves);
    setLeaves(initialLeaves);
  }
  const [prevInitialBalances, setPrevInitialBalances] = useState(initialBalances);
  if (initialBalances !== prevInitialBalances) {
    setPrevInitialBalances(initialBalances);
    setBalances(initialBalances);
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    pending: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
  };

  const getBalance = (type: string) => {
    const b = balances.find(bal => bal.leave_type === type);
    return b ? b.remaining_days : 0;
  };

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-lg bg-navy-900 p-6 text-white shadow-md shadow-navy-900/10">
        <div className="absolute top-[-25%] right-[-15%] w-[40%] h-[120%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px] font-medium uppercase tracking-wider text-primary-200">
              <Sparkles className="w-3 h-3 text-primary-400" />
              <span>Leave Balance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Leave Management</h1>
            <p className="text-zinc-400 text-xs mt-1 font-medium leading-relaxed font-sans">Track your available Casual Leave balance and request time off.</p>
          </div>
          <Button 
            onClick={() => setIsApplying(true)} 
            className="bg-white text-navy-900 hover:bg-zinc-100 rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 group shrink-0 flex items-center gap-1.5 font-sans"
          >
            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform text-navy-900" /> 
            Request Leave
          </Button>
        </div>
      </div>

      {/* Summary Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Casual Leave (This Month)', type: 'Casual', color: 'text-primary-650', bg: 'bg-primary-50 border-primary-100', icon: Coffee },
          { label: 'Pending Approval', type: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Hourglass },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group bg-white rounded-lg p-5 border border-zinc-200 hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
              <div className={`w-8 h-8 rounded border ${stat.bg} ${stat.color} flex items-center justify-center mb-3 transition-transform group-hover:scale-105 duration-200 shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight leading-none mb-1 font-mono">
                {stat.type === 'Pending' ? leaves.filter(l => (l.status || 'Pending').toLowerCase() === 'pending').length : getBalance(stat.type)}
              </p>
              <p className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* History Sequence */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1 pt-2">
          <div className="w-1 h-4 bg-primary-500 rounded" />
          <h2 className="font-bold text-navy-900 text-base tracking-tight font-sans">Request Log</h2>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs divide-y divide-zinc-150 overflow-hidden font-sans">
          {leaves.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-5 h-5 text-zinc-450" />
              </div>
              <p className="text-xs font-mono font-semibold text-navy-900 uppercase tracking-wider">No Requests Found</p>
              <p className="text-xs text-zinc-400 mt-1 italic">You have no leave requests at the moment.</p>
            </div>
          ) : (
            leaves.map((leave) => {
              const leaveStatus = (leave.status || 'Pending').toLowerCase();
              const Icon = statusIcons[leaveStatus] || AlertCircle;
              return (
                <div key={leave.id} className="p-4 hover:bg-zinc-50/50 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded border flex items-center justify-center shrink-0 transition-all",
                      leaveStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                      leaveStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-650' :
                      'bg-amber-50 border-amber-200 text-amber-600'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-navy-900 tracking-tight">{leave.type} Leave</p>
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-medium border uppercase tracking-wider",
                          leaveStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          leaveStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        )}>
                          <span className={cn("w-1 h-1 rounded-full mr-1 shrink-0", 
                            leaveStatus === 'approved' ? 'bg-emerald-500' :
                            leaveStatus === 'rejected' ? 'bg-red-500' :
                            'bg-amber-500'
                          )} />
                          {leave.status || 'Pending'}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                        {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                      </p>
                      {leave.reason && (
                        <p className="text-[11px] text-zinc-600 mt-2 italic leading-relaxed max-w-lg bg-zinc-50 px-3 py-2 rounded border border-zinc-200">
                          &ldquo;{leave.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-right">
                    <div className="hidden md:block">
                      <p className="text-[8px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Approval Status</p>
                      <p className="text-[10px] font-semibold text-navy-900 font-sans">{leave.status === 'Approved' ? 'Approved' : 'Awaiting Approval'}</p>
                    </div>
                    <div className="w-7 h-7 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-950 transition-all">
                      <TrendingUp className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Apply Modal Interface */}
      <AnimatePresence>
        {isApplying && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm cursor-pointer" onClick={() => setIsApplying(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 10 }} 
              transition={{ duration: 0.15 }}
              className="w-full max-w-xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-lg p-6 border border-zinc-200 shadow-xl relative overflow-hidden font-sans">
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => setIsApplying(false)}
                    className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-550 hover:bg-zinc-100 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1 h-4 bg-primary-500 rounded" />
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Apply for Leave</h2>
                  </div>
                  <p className="text-xs text-zinc-450 font-medium italic">Submit a leave request for manager approval.</p>
                </div>

                <LeaveRequestForm onSuccess={() => {
                  setIsApplying(false);
                  router.refresh();
                }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
