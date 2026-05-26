'use client';

import { useState } from 'react';
import { 
  Calendar, Home, CheckCircle2, XCircle, 
  Clock, MapPin, User, Loader2, 
  Sparkles, ShieldCheck, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { updateLeaveStatus, updateWFHStatus } from './actions';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';

type Tab = 'leaves' | 'wfh' | 'history';

export default function ApprovalsClient({ 
  initialLeaves, 
  initialWFH,
  initialHistory,
}: { 
  initialLeaves: any[];
  initialWFH: any[];
  initialHistory: any[];
}) {
  const [leaves, setLeaves] = useState(initialLeaves);
  const [wfh, setWfh] = useState(initialWFH);
  const [activeTab, setActiveTab] = useState<Tab>('leaves');
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const handleLeaveAction = async (id: string, status: 'Approved' | 'Rejected') => {
    setProcessing(id);
    try {
      const res = await updateLeaveStatus(id, status);
      if (res && !res.success) {
        toast.error(res.error || 'Failed to update leave request status.');
      } else {
        setLeaves(prev => prev.filter(l => l.id !== id));
        toast.success(`Leave request ${status.toLowerCase()} successfully.`);
      }
    } catch (err) {
      toast.error('Failed to update leave request status.');
    } finally {
      setProcessing(null);
    }
  };

  const handleWFHAction = async (id: string, status: 'Approved WFH' | 'Rejected WFH') => {
    setProcessing(id);
    try {
      const res = await updateWFHStatus(id, status);
      if (res && !res.success) {
        toast.error(res.error || 'Failed to update remote work request status.');
      } else {
        setWfh(prev => prev.filter(w => w.id !== id));
        toast.success(`Remote work request ${status === 'Approved WFH' ? 'approved' : 'rejected'} successfully.`);
      }
    } catch (err) {
      toast.error('Failed to update remote work request status.');
    } finally {
      setProcessing(null);
    }
  };

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'leaves', label: 'Time Off', icon: Calendar, count: leaves.length || undefined },
    { id: 'wfh', label: 'Remote Work', icon: Home, count: wfh.length || undefined },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-8">
      {/* Tab Selection */}
      <div className="flex p-1.5 bg-surface-alt/50 backdrop-blur-sm rounded-[2rem] w-fit border border-border/60 shadow-inner-lg">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-3 px-8 py-3.5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300",
                activeTab === tab.id
                  ? "bg-navy-900 text-white shadow-xl shadow-navy-900/10 scale-[1.02]"
                  : "text-text-muted hover:text-navy-900"
              )}
            >
              <Icon className={cn("w-4 h-4", activeTab === tab.id ? "text-primary-400" : "text-text-muted")} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-lg",
                  activeTab === tab.id ? "bg-primary-500 text-white" : "bg-navy-900 text-white"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="wait">
          {activeTab === 'leaves' && (
            <motion.div key="leaves" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {leaves.length === 0 ? (
                <div className="p-20 text-center rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-text-muted font-black uppercase tracking-widest">Registry Clear: No Pending Leave Requests</p>
                </div>
              ) : (
                leaves.map((leave) => (
                  <Card key={leave.id} hover={false} className="p-8 rounded-[2.5rem] border-l-[6px] border-l-amber-500 shadow-sm bg-white overflow-hidden relative group">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
                      <div className="flex items-start gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-navy-900 text-white flex items-center justify-center shrink-0 shadow-2xl shadow-navy-900/10">
                          <User className="w-8 h-8" />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-2xl font-black text-navy-900 tracking-tight leading-none">{leave.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-4 mt-3">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-alt border border-border/50 text-[11px] font-bold text-navy-900 uppercase tracking-tighter">
                                <Calendar className="w-3.5 h-3.5 text-primary-500" />
                                {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[11px] font-black text-amber-700 uppercase tracking-widest">
                                <Sparkles className="w-3.5 h-3.5" />
                                {leave.type} LEAVE
                              </div>
                            </div>
                          </div>
                          {leave.reason && (
                            <div className="relative pl-6 py-1">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500/20 rounded-full" />
                              <p className="text-sm text-text-secondary font-medium italic leading-relaxed">"{leave.reason}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" onClick={() => handleLeaveAction(leave.id, 'Rejected')} disabled={processing === leave.id} className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50 px-8 py-4 font-black text-[11px] uppercase tracking-widest h-auto shadow-sm">
                          <XCircle className="w-4 h-4 mr-2" /> Deny
                        </Button>
                        <Button onClick={() => handleLeaveAction(leave.id, 'Approved')} disabled={processing === leave.id} className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-4 font-black text-[11px] uppercase tracking-widest h-auto shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                          {processing === leave.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Authorize</>}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'wfh' && (
            <motion.div key="wfh" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {wfh.length === 0 ? (
                <div className="p-20 text-center rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <Home className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-text-muted font-black uppercase tracking-widest">Network Clear: No Remote Work Requests</p>
                </div>
              ) : (
                wfh.map((request) => (
                  <Card key={request.id} hover={false} className="p-8 rounded-[2.5rem] border-l-[6px] border-l-primary-500 shadow-sm bg-white overflow-hidden relative group">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
                      <div className="flex items-start gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-primary-500 text-white flex items-center justify-center shrink-0 shadow-2xl shadow-primary-500/10">
                          <Home className="w-8 h-8" />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-2xl font-black text-navy-900 tracking-tight leading-none">{request.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-4 mt-3">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-alt border border-border/50 text-[11px] font-bold text-navy-900 uppercase tracking-tighter">
                                <Calendar className="w-3.5 h-3.5 text-primary-500" />
                                {formatDate(request.date)}
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-[11px] font-black text-violet-700 uppercase tracking-widest">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(request.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-4 py-2.5 rounded-[1.25rem] bg-navy-900 text-white/90 text-[10px] font-black uppercase tracking-[0.1em] border border-white/5 w-fit">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            Geolocation Sync: {request.lat.toFixed(6)}, {request.lng.toFixed(6)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" onClick={() => handleWFHAction(request.id, 'Rejected WFH')} disabled={processing === request.id} className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50 px-8 py-4 font-black text-[11px] uppercase tracking-widest h-auto shadow-sm">
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                        <Button onClick={() => handleWFHAction(request.id, 'Approved WFH')} disabled={processing === request.id} className="rounded-2xl bg-navy-900 hover:bg-navy-800 text-white px-10 py-4 font-black text-[11px] uppercase tracking-widest h-auto shadow-xl shadow-navy-900/10 active:scale-95 transition-all">
                          {processing === request.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Verify & Authorize</>}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              {initialHistory.length === 0 ? (
                <div className="p-20 text-center rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-text-muted font-black uppercase tracking-widest">No approval history yet</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-alt/50 border-b border-border">
                          <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Employee</th>
                          <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Type</th>
                          <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Period</th>
                          <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                          <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {initialHistory.map((item: any) => (
                          <tr key={item.id} className="hover:bg-surface-alt/20 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-semibold text-navy-900">{item.employee_name}</p>
                              <p className="text-[10px] text-text-muted">{item.employee_email}</p>
                            </td>
                            <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                              {item.kind === 'leave' ? `${item.type} Leave` : 'WFH'}
                            </td>
                            <td className="px-4 py-2.5 text-[10px] text-text-muted font-medium">
                              {item.kind === 'leave'
                                ? `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`
                                : formatDate(item.date)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
                                item.status === 'Approved' || item.status === 'Approved WFH'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 border-red-500/20'
                              )}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[10px] text-text-muted font-medium whitespace-nowrap">
                              {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden divide-y divide-border/40">
                    {initialHistory.map((item: any) => (
                      <div key={item.id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-navy-900">{item.employee_name}</p>
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
                            item.status === 'Approved' || item.status === 'Approved WFH'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                          )}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted">
                          {item.kind === 'leave' ? `${item.type} Leave` : 'WFH'} ·{' '}
                          {item.kind === 'leave'
                            ? `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`
                            : formatDate(item.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
