'use client';

import { useState, useEffect } from 'react';
import { Calendar, Plus, X, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Sparkles, Plane, TrendingUp, History, HeartPulse, Coffee, Award, Hourglass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LeaveRequestForm from '@/components/employee/LeaveRequestForm';
import { getEmployeeLeaves, getLeaveBalances } from './actions';
import { formatDate, cn } from '@/lib/utils';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [leavesData, balancesData] = await Promise.all([
      getEmployeeLeaves(),
      getLeaveBalances()
    ]);
    setLeaves(leavesData);
    setBalances(balancesData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  };

  const statusIcons: Record<string, any> = {
    pending: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
  };

  const getBalance = (type: string) => {
    const b = balances.find(bal => bal.leave_type === type);
    return b ? b.remaining_days : 0;
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-xl bg-navy-900 p-6 text-white shadow-md shadow-navy-900/10">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary-200">Leave Balance</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Leave Management</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium italic">Track your available leave balances and request time off.</p>
          </div>
          <Button 
            onClick={() => setIsApplying(true)} 
            className="bg-white text-navy-900 hover:bg-white/90 rounded-lg px-4 py-2 text-xs font-semibold shadow transition-all active:scale-95 group shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5 group-hover:rotate-90 transition-transform" /> 
            Request Leave
          </Button>
        </div>
      </div>

      {/* Summary Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sick Leave', type: 'Sick', color: 'text-rose-500', bg: 'bg-rose-500/10', icon: HeartPulse },
          { label: 'Casual Leave', type: 'Casual', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Coffee },
          { label: 'Earned Leave', type: 'Earned', color: 'text-primary-500', bg: 'bg-primary-500/10', icon: Award },
          { label: 'Pending Approval', type: 'Pending', color: 'text-indigo-500', bg: 'bg-indigo-500/10', icon: Hourglass },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group bg-white rounded-xl p-4 border border-border/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary-200 hover:-translate-y-0.5">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-200 shrink-0`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-black text-navy-900 tracking-tight leading-none mb-1 group-hover:text-primary-600 transition-colors">
                {loading ? '...' : stat.type === 'Pending' ? leaves.filter(l => l.status.toLowerCase() === 'pending').length : getBalance(stat.type)}
              </p>
              <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* History Sequence */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-5 bg-primary-500 rounded-full" />
          <h2 className="font-semibold text-navy-900 text-lg tracking-tight">Request Log</h2>
        </div>

        <Card hover={false} className="p-0 overflow-hidden rounded-xl border-border/60 shadow-sm bg-white">
          <div className="divide-y divide-border/40">
            {loading ? (
              <div className="p-12 text-center text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 opacity-20 text-primary-500" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Loading Requests...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6 text-text-muted/30" />
                </div>
                <p className="text-xs font-bold text-navy-900 uppercase tracking-tight">No Requests Found</p>
                <p className="text-[11px] text-text-muted mt-1 italic">You have no leave requests at the moment.</p>
              </div>
            ) : (
              leaves.map((leave) => {
                const Icon = statusIcons[leave.status.toLowerCase()] || AlertCircle;
                return (
                  <div key={leave.id} className="p-4 hover:bg-surface-alt/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                        statusColors[leave.status.toLowerCase()]
                      )}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-navy-900 tracking-tight">{leave.type} Leave</p>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                            statusColors[leave.status.toLowerCase()]
                          )}>
                            {leave.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
                          {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                        </p>
                        {leave.reason && (
                          <p className="text-[10px] text-text-secondary mt-1.5 italic leading-relaxed max-w-sm bg-surface-alt/50 px-3 py-1.5 rounded-lg border border-border/40">
                            &ldquo;{leave.reason}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-right">
                      <div className="hidden md:block">
                        <p className="text-[8px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Approval Status</p>
                        <p className="text-[10px] font-semibold text-navy-900">{leave.status === 'Approved' ? 'Approved' : 'Awaiting Approval'}</p>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center group-hover:bg-navy-900 group-hover:text-white transition-all">
                        <TrendingUp className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Apply Modal Interface */}
      <AnimatePresence>
        {isApplying && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-md cursor-pointer" onClick={() => setIsApplying(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="w-full max-w-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <Card hover={false} className="p-6 rounded-xl border-0 shadow-2xl bg-white relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => setIsApplying(false)}
                    className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center text-navy-900 hover:bg-navy-900 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1 h-5 bg-primary-500 rounded-full" />
                    <h2 className="text-xl font-bold text-navy-900 tracking-tight">Apply for Leave</h2>
                  </div>
                  <p className="text-xs text-text-muted font-medium italic">Submit a leave request for manager approval.</p>
                </div>

                <LeaveRequestForm onSuccess={() => {
                  setIsApplying(false);
                  fetchData();
                }} />
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
