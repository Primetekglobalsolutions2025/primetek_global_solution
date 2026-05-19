'use client';

import { useState, useEffect } from 'react';
import { Calendar, Plus, X, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Sparkles, Plane, TrendingUp, History } from 'lucide-react';
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
    <div className="space-y-8 pb-24">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-navy-900 p-8 text-white shadow-xl shadow-navy-900/10">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-200">Leave Balance</span>
            </div>
            <h1 className="text-3xl font-heading font-black tracking-tight text-white">Leave Management</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium italic">Track your available leave balances and request time off.</p>
          </div>
          <Button 
            onClick={() => setIsApplying(true)} 
            className="bg-white text-navy-900 hover:bg-white/90 rounded-2xl px-8 py-6 font-black shadow-2xl shadow-white/5 transition-all active:scale-95 group shrink-0"
          >
            <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform" /> 
            Request Leave
          </Button>
        </div>
      </div>

      {/* Summary Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Sick Leave', type: 'Sick', color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Casual Leave', type: 'Casual', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Earned Leave', type: 'Earned', color: 'text-primary-500', bg: 'bg-primary-500/10' },
          { label: 'Pending Approval', type: 'Pending', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="group bg-white rounded-[2rem] p-6 border border-border/60 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              <Plane className="w-5 h-5" />
            </div>
            <p className="text-4xl font-black text-navy-900 tracking-tight leading-none mb-1 group-hover:text-primary-600 transition-colors">
              {loading ? '...' : stat.type === 'Pending' ? leaves.filter(l => l.status === 'Pending').length : getBalance(stat.type)}
            </p>
            <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* History Sequence */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-4">
          <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
          <h2 className="font-heading font-black text-navy-900 text-2xl tracking-tight">Request Log</h2>
        </div>

        <Card hover={false} className="p-0 overflow-hidden rounded-[2.5rem] border-border/60 shadow-sm bg-white">
          <div className="divide-y divide-border/40">
            {loading ? (
              <div className="p-20 text-center text-text-muted">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading Requests...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div className="p-20 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-text-muted/30" />
                </div>
                <p className="text-sm font-black text-navy-900 uppercase tracking-tight">No Requests Found</p>
                <p className="text-xs text-text-muted mt-1 italic">You have no leave requests at the moment.</p>
              </div>
            ) : (
              leaves.map((leave) => {
                const Icon = statusIcons[leave.status.toLowerCase()] || AlertCircle;
                return (
                  <div key={leave.id} className="p-8 hover:bg-surface-alt/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-110",
                        statusColors[leave.status.toLowerCase()]
                      )}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-black text-navy-900 tracking-tight">{leave.type} Leave</p>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            statusColors[leave.status.toLowerCase()]
                      )}>
                            {leave.status}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-widest">
                          {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                        </p>
                        {leave.reason && (
                          <p className="text-xs text-text-secondary mt-3 italic leading-relaxed max-w-md bg-surface-alt/50 px-4 py-2 rounded-2xl border border-border/40">
                            &ldquo;{leave.reason}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div className="hidden md:block">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Approval Status</p>
                        <p className="text-xs font-bold text-navy-900">{leave.status === 'Approved' ? 'Approved' : 'Awaiting Approval'}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center group-hover:bg-navy-900 group-hover:text-white transition-all">
                        <TrendingUp className="w-4 h-4 opacity-40 group-hover:opacity-100" />
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-md" onClick={() => setIsApplying(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Card hover={false} className="p-10 rounded-[3rem] border-0 shadow-2xl bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                  <button 
                    onClick={() => setIsApplying(false)}
                    className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center text-navy-900 hover:bg-navy-900 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-6 bg-primary-500 rounded-full" />
                    <h2 className="text-3xl font-heading font-black text-navy-900 tracking-tight">Apply for Leave</h2>
                  </div>
                  <p className="text-sm text-text-muted font-medium italic">Submit a leave request for manager approval.</p>
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
