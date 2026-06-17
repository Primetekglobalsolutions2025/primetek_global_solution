'use client';

import { useState, useRef } from 'react';
import { Calendar, Plus, X, Clock, CheckCircle2, XCircle, AlertCircle, Coffee, Hourglass, TrendingUp, Home, Laptop } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import LeaveRequestForm from '@/components/employee/LeaveRequestForm';
import WFHRequestForm from '@/components/employee/WFHRequestForm';
import { formatDate, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import StatusBadge from '@/components/ui/StatusBadge';
import { typography } from '@/styles/design-system';

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

export interface WFHRecord {
  id: string;
  employee_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
}

export default function LeavesClient({
  initialLeaves,
  initialBalances,
  initialWfhRequests = []
}: {
  initialLeaves: LeaveRecord[];
  initialBalances: LeaveBalance[];
  initialWfhRequests?: WFHRecord[];
}) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveRecord[]>(initialLeaves);
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances);
  const [wfhRequests, setWfhRequests] = useState<WFHRecord[]>(initialWfhRequests);
  const [activeTab, setActiveTab] = useState<'leaves' | 'wfh'>('leaves');
  const [isApplyingLeave, setIsApplyingLeave] = useState(false);
  const [isApplyingWfh, setIsApplyingWfh] = useState(false);

  const leaveModalRef = useRef<HTMLDivElement>(null);
  const wfhModalRef = useRef<HTMLDivElement>(null);

  useModalFocusTrap(leaveModalRef, isApplyingLeave, () => setIsApplyingLeave(false));
  useModalFocusTrap(wfhModalRef, isApplyingWfh, () => setIsApplyingWfh(false));

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
  const [prevInitialWfh, setPrevInitialWfh] = useState(initialWfhRequests);
  if (initialWfhRequests !== prevInitialWfh) {
    setPrevInitialWfh(initialWfhRequests);
    setWfhRequests(initialWfhRequests);
  }

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
              <span>Time Off & Remote Work</span>
            </div>
            <h1 className={typography.pageTitleLight}>Leaves & WFH</h1>
            <p className="text-zinc-400 text-xs mt-1 font-medium leading-relaxed font-sans">
              Manage your calendar, request time off, and request/track remote work schedules.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'leaves' ? (
              <Button 
                onClick={() => setIsApplyingLeave(true)} 
                className="bg-white text-navy-900 hover:bg-zinc-100 rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 group shrink-0 flex items-center gap-1.5 font-sans"
              >
                <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform text-navy-900" /> 
                Request Leave
              </Button>
            ) : (
              <Button 
                onClick={() => setIsApplyingWfh(true)} 
                className="bg-white text-navy-900 hover:bg-zinc-100 rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 group shrink-0 flex items-center gap-1.5 font-sans"
              >
                <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform text-navy-900" /> 
                Request WFH
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('leaves')}
          className={cn(
            "px-6 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === 'leaves' 
              ? "border-primary-500 text-primary-600" 
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          )}
        >
          <Coffee className="w-4 h-4" />
          Leave Requests
        </button>
        <button
          onClick={() => setActiveTab('wfh')}
          className={cn(
            "px-6 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === 'wfh' 
              ? "border-primary-500 text-primary-600" 
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          )}
        >
          <Home className="w-4 h-4" />
          Work From Home
        </button>
      </div>

      {activeTab === 'leaves' ? (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Leaves Summary Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Casual Leave (This Month)', type: 'Casual', color: 'text-primary-650', bg: 'bg-primary-50 border-primary-100', icon: Coffee },
              { label: 'Pending Leaves', type: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Hourglass },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group bg-white rounded-xl p-5 border border-zinc-250/70 hover:border-primary-500/45 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 ease-out relative overflow-hidden">
                  {/* Subtle top border accent on hover */}
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
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

          {/* Leaves Log */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 pt-2">
              <div className="w-1 h-4 bg-primary-500 rounded" />
              <h2 className="font-bold text-navy-900 text-base tracking-tight font-sans">Leave Log</h2>
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
                            <StatusBadge status={leave.status || 'Pending'} />
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
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* WFH Summary Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Approved WFH Days', type: 'Approved', color: 'text-primary-650', bg: 'bg-primary-50 border-primary-100', icon: Laptop },
              { label: 'Pending Requests', type: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Hourglass },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group bg-white rounded-xl p-5 border border-zinc-250/70 hover:border-primary-500/45 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 ease-out relative overflow-hidden">
                  {/* Subtle top border accent on hover */}
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className={`w-8 h-8 rounded border ${stat.bg} ${stat.color} flex items-center justify-center mb-3 transition-transform group-hover:scale-105 duration-200 shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold text-navy-900 tracking-tight leading-none mb-1 font-mono">
                    {stat.type === 'Pending' 
                      ? wfhRequests.filter(r => r.status === 'Pending').length 
                      : wfhRequests.filter(r => r.status === 'Approved').length}
                  </p>
                  <p className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* WFH Requests Log */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 pt-2">
              <div className="w-1 h-4 bg-primary-500 rounded" />
              <h2 className="font-bold text-navy-900 text-base tracking-tight font-sans">WFH Schedule & Requests</h2>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs divide-y divide-zinc-150 overflow-hidden font-sans">
              {wfhRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-10 h-10 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                    <Home className="w-5 h-5 text-zinc-450" />
                  </div>
                  <p className="text-xs font-mono font-semibold text-navy-900 uppercase tracking-wider">No WFH Schedules</p>
                  <p className="text-xs text-zinc-400 mt-1 italic">You have no active WFH schedules or date requests.</p>
                </div>
              ) : (
                wfhRequests.map((request) => {
                  const reqStatus = (request.status || 'Pending').toLowerCase();
                  const Icon = statusIcons[reqStatus] || AlertCircle;
                  const isGlobal = request.employee_id === null;

                  return (
                    <div key={request.id} className="p-4 hover:bg-zinc-50/50 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-8 h-8 rounded border flex items-center justify-center shrink-0 transition-all",
                          isGlobal ? 'bg-indigo-50 border-indigo-200 text-indigo-650' :
                          reqStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                          reqStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-650' :
                          'bg-amber-50 border-amber-200 text-amber-600'
                        )}>
                          {isGlobal ? <Laptop className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-navy-900 tracking-tight">
                              {isGlobal ? 'Global WFH Override' : 'Work From Home'}
                            </p>
                            <StatusBadge status={request.status || 'Pending'} />
                          </div>
                          <p className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                            {formatDate(request.start_date)} — {formatDate(request.end_date)}
                          </p>
                          {request.reason && (
                            <p className="text-[11px] text-zinc-600 mt-2 italic leading-relaxed max-w-lg bg-zinc-50 px-3 py-2 rounded border border-zinc-200">
                              &ldquo;{request.reason}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-right">
                        <div className="hidden md:block">
                          <p className="text-[8px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Class</p>
                          <p className="text-[10px] font-semibold text-navy-900 font-sans">{isGlobal ? 'Company-wide' : 'Individual'}</p>
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
        </motion.div>
      )}

      {/* Apply Leave Modal */}
      <AnimatePresence>
        {isApplyingLeave && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm cursor-pointer" onClick={() => setIsApplyingLeave(false)}>
            <motion.div 
              ref={leaveModalRef}
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
                    onClick={() => setIsApplyingLeave(false)}
                    className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-550 hover:bg-zinc-100 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4 text-zinc-450" />
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
                  setIsApplyingLeave(false);
                  router.refresh();
                }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Apply WFH Modal */}
      <AnimatePresence>
        {isApplyingWfh && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm cursor-pointer" onClick={() => setIsApplyingWfh(false)}>
            <motion.div 
              ref={wfhModalRef}
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
                    onClick={() => setIsApplyingWfh(false)}
                    className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-550 hover:bg-zinc-100 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4 text-zinc-450" />
                  </button>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1 h-4 bg-primary-500 rounded" />
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Request WFH Dates</h2>
                  </div>
                  <p className="text-xs text-zinc-450 font-medium italic">Request a scheduled Work From Home period for approval.</p>
                </div>

                <WFHRequestForm onSuccess={() => {
                  setIsApplyingWfh(false);
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
