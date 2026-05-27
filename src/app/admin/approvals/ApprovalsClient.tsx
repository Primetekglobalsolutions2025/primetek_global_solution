'use client';

import { useState } from 'react';
import { 
  Calendar, Home, CheckCircle2, XCircle, 
  Clock, MapPin, User, Loader2, 
  Sparkles, ShieldCheck, History, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { updateLeaveStatus, updateWFHStatus, resolveDispute } from './actions';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';

type Tab = 'leaves' | 'wfh' | 'disputes' | 'history';

const formatSafeTime = (timeStr: any) => {
  if (!timeStr) return '--:--';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const formatSafeDate = (dateStr: any) => {
  if (!dateStr) return '-- --- ----';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ApprovalsClient({ 
  initialLeaves, 
  initialWFH,
  initialHistory,
  initialDisputes = [],
}: { 
  initialLeaves: any[];
  initialWFH: any[];
  initialHistory: any[];
  initialDisputes?: any[];
}) {
  const [leaves, setLeaves] = useState(initialLeaves);
  const [wfh, setWfh] = useState(initialWFH);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [activeTab, setActiveTab] = useState<Tab>('leaves');
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const [disputeResolutionText, setDisputeResolutionText] = useState('');
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const handleResolveDisputeSubmit = async (disputeId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!disputeResolutionText || disputeResolutionText.trim() === '') {
      toast.error('A justification reason is required to resolve a dispute.');
      return;
    }
    setProcessing(disputeId);
    try {
      const res = await resolveDispute(disputeId, status, disputeResolutionText);
      if (res && res.success) {
        setDisputes(prev => prev.filter(d => d.id !== disputeId));
        toast.success(`Dispute successfully ${status === 'APPROVED' ? 'approved' : 'rejected'}.`);
        setResolvingDisputeId(null);
        setDisputeResolutionText('');
        setResolutionStatus(null);
      } else {
        toast.error('Failed to resolve dispute.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to resolve dispute.');
    } finally {
      setProcessing(null);
    }
  };

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
    { id: 'disputes', label: 'Disputes Queue', icon: AlertTriangle, count: disputes.length || undefined },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Selection */}
      <div className="flex p-1 bg-white/70 backdrop-blur-md rounded-2xl md:rounded-[2rem] w-full md:w-fit border border-border/60 shadow-sm overflow-x-auto scrollbar-none flex-nowrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.5rem] text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.2em] transition-all duration-300 whitespace-nowrap shrink-0 flex-1 md:flex-initial",
                activeTab === tab.id
                  ? "bg-navy-900 text-white shadow-md scale-[1.02]"
                  : "text-text-muted hover:text-navy-900 hover:bg-surface-alt/50"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4", activeTab === tab.id ? "text-primary-400" : "text-text-muted")} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 w-4 md:w-5 h-4 md:h-5 rounded-full flex items-center justify-center text-[8px] md:text-[9px] font-black shadow-md",
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
            <motion.div key="leaves" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6">
              {leaves.length === 0 ? (
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-gray-300" />
                  </div>
                  <p className="text-xs md:text-sm text-text-muted font-black uppercase tracking-widest">Registry Clear: No Pending Leave Requests</p>
                </div>
              ) : (
                leaves.map((leave) => (
                  <Card key={leave.id} hover={false} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border-l-[6px] border-l-amber-500 shadow-sm bg-white overflow-hidden relative group">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-10">
                      <div className="flex items-start gap-4 md:gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-navy-900 text-white flex items-center justify-center shrink-0 shadow-2xl shadow-navy-900/10">
                          <User className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="space-y-3 md:space-y-4 w-full">
                          <div>
                            <h3 className="text-lg md:text-2xl font-black text-navy-900 tracking-tight leading-none">{leave.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2.5 md:mt-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-surface-alt border border-border/50 text-[10px] md:text-[11px] font-bold text-navy-900 uppercase tracking-tighter">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-500" />
                                {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-amber-50 border border-amber-100 text-[10px] md:text-[11px] font-black text-amber-700 uppercase tracking-wider md:tracking-widest">
                                {leave.type} LEAVE
                              </div>
                            </div>
                          </div>
                          {leave.reason && (
                            <div className="relative pl-4 md:pl-6 py-0.5 md:py-1">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500/20 rounded-full" />
                              <p className="text-xs md:text-sm text-text-secondary font-medium italic leading-relaxed">"{leave.reason}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 border-t border-border/40 xl:border-t-0 pt-4 xl:pt-0">
                        <Button variant="outline" onClick={() => handleLeaveAction(leave.id, 'Rejected')} disabled={processing === leave.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl border-red-200 text-red-600 hover:bg-red-50 px-4 md:px-8 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-sm">
                          <XCircle className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Deny
                        </Button>
                        <Button onClick={() => handleLeaveAction(leave.id, 'Approved')} disabled={processing === leave.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 md:px-10 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-lg shadow-emerald-500/10 active:scale-95 transition-all">
                          {processing === leave.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 md:mr-2" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Authorize</>}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'wfh' && (
            <motion.div key="wfh" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6">
              {wfh.length === 0 ? (
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <Home className="w-6 h-6 md:w-8 md:h-8 text-gray-300" />
                  </div>
                  <p className="text-xs md:text-sm text-text-muted font-black uppercase tracking-widest">Network Clear: No Remote Work Requests</p>
                </div>
              ) : (
                wfh.map((request) => (
                  <Card key={request.id} hover={false} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border-l-[6px] border-l-primary-500 shadow-sm bg-white overflow-hidden relative group">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-10">
                      <div className="flex items-start gap-4 md:gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-primary-500 text-white flex items-center justify-center shrink-0 shadow-2xl shadow-primary-500/10">
                          <Home className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="space-y-3 md:space-y-4 w-full">
                          <div>
                            <h3 className="text-lg md:text-2xl font-black text-navy-900 tracking-tight leading-none">{request.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2.5 md:mt-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-surface-alt border border-border/50 text-[10px] md:text-[11px] font-bold text-navy-900 uppercase tracking-tighter">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-500" />
                                {formatDate(request.date)}
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-violet-50 border border-violet-100 text-[10px] md:text-[11px] font-black text-violet-700 uppercase tracking-wider md:tracking-widest">
                                <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                {formatSafeTime(request.check_in)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy-900 text-white/90 text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] border border-white/5 w-fit">
                            <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 text-red-500" />
                            Geolocation Sync: {typeof request.lat === 'number' ? request.lat.toFixed(6) : (request.lat ? Number(request.lat).toFixed(6) : '0.000000')}, {typeof request.lng === 'number' ? request.lng.toFixed(6) : (request.lng ? Number(request.lng).toFixed(6) : '0.000000')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 border-t border-border/40 xl:border-t-0 pt-4 xl:pt-0">
                        <Button variant="outline" onClick={() => handleWFHAction(request.id, 'Rejected WFH')} disabled={processing === request.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl border-red-200 text-red-600 hover:bg-red-50 px-4 md:px-8 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-sm">
                          <XCircle className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Reject
                        </Button>
                        <Button onClick={() => handleWFHAction(request.id, 'Approved WFH')} disabled={processing === request.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl bg-navy-900 hover:bg-navy-800 text-white px-5 md:px-10 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-xl shadow-navy-900/10 active:scale-95 transition-all">
                          {processing === request.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 md:mr-2" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Verify & Authorize</>}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'disputes' && (
            <motion.div key="disputes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6">
              {disputes.length === 0 ? (
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-gray-300" />
                  </div>
                  <p className="text-xs md:text-sm text-text-muted font-black uppercase tracking-widest">Registry Clear: No Pending Attendance Disputes</p>
                </div>
              ) : (
                disputes.map((dispute) => (
                  <Card key={dispute.id} hover={false} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border-l-[6px] border-l-violet-500 shadow-sm bg-white overflow-hidden relative group">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 md:gap-10">
                      <div className="flex items-start gap-4 md:gap-6 flex-1">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xl shadow-violet-650/10">
                          <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="space-y-3 md:space-y-4 w-full">
                          <div>
                            <h3 className="text-lg md:text-2xl font-black text-navy-900 tracking-tight leading-none">{dispute.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2.5 md:mt-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-surface-alt border border-border/50 text-[10px] md:text-[11px] font-bold text-navy-900 uppercase tracking-tighter">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-500" />
                                {formatSafeDate(dispute.attendance_date)}
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-violet-55 border border-violet-100 text-[10px] md:text-[11px] font-black text-violet-755 uppercase tracking-wider md:tracking-widest">
                                {dispute.category.replace('_', ' ')}
                              </div>
                              {dispute.attendance_is_late && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-amber-50 border border-amber-100 text-[10px] md:text-[11px] font-black text-amber-700 uppercase tracking-wider">
                                  Late: +{dispute.attendance_late_minutes}m
                                </div>
                              )}
                              {dispute.attendance_deduction > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-red-50 border border-red-100 text-[10px] md:text-[11px] font-black text-red-700 uppercase tracking-wider">
                                  Deduction: -{dispute.attendance_deduction} Day
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {dispute.reason && (
                            <div className="relative pl-4 md:pl-6 py-0.5 md:py-1">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500/20 rounded-full" />
                              <p className="text-xs md:text-sm text-text-secondary font-medium italic leading-relaxed">
                                <span className="font-bold text-navy-900 not-italic block text-[10px] uppercase tracking-wider mb-1">Employee Explanation:</span>
                                "{dispute.reason}"
                              </p>
                            </div>
                          )}

                          {/* Resolution Form Expanded for this Dispute */}
                          {resolvingDisputeId === dispute.id && resolutionStatus && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }} 
                              animate={{ opacity: 1, height: 'auto' }} 
                              className="bg-surface-alt/40 p-4 rounded-xl border border-border/50 space-y-3 mt-4"
                            >
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-navy-900 block font-mono">
                                  Justification Reason for {resolutionStatus === 'APPROVED' ? 'Approval' : 'Rejection'}
                                </label>
                                <textarea
                                  placeholder="Enter the operational or payroll context for audit compliance..."
                                  required
                                  rows={2}
                                  value={disputeResolutionText}
                                  onChange={(e) => setDisputeResolutionText(e.target.value)}
                                  className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white text-navy-950 placeholder:text-zinc-300"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvingDisputeId(null);
                                    setResolutionStatus(null);
                                    setDisputeResolutionText('');
                                  }}
                                  className="px-3 py-1.5 bg-white border border-border rounded-lg text-[10px] font-bold text-text-muted hover:text-navy-900 transition-colors uppercase"
                                >
                                  Cancel
                                </button>
                                <Button
                                  onClick={() => handleResolveDisputeSubmit(dispute.id, resolutionStatus)}
                                  disabled={processing === dispute.id}
                                  className={cn(
                                    "px-4 py-1.5 text-[10px] uppercase font-bold text-white rounded-lg flex items-center gap-1.5 shadow-sm",
                                    resolutionStatus === 'APPROVED' ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-555' : 'bg-red-500 hover:bg-red-650 border-red-555'
                                  )}
                                >
                                  {processing === dispute.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      {resolutionStatus === 'APPROVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                      Confirm {resolutionStatus === 'APPROVED' ? 'Approval' : 'Denial'}
                                    </>
                                  )}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Main review buttons */}
                      {resolvingDisputeId !== dispute.id && (
                        <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 border-t border-border/40 xl:border-t-0 pt-4 xl:pt-0">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setResolvingDisputeId(dispute.id);
                              setResolutionStatus('REJECTED');
                              setDisputeResolutionText('');
                            }} 
                            className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl border-red-200 text-red-600 hover:bg-red-50 px-4 md:px-8 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-sm"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Deny
                          </Button>
                          <Button 
                            onClick={() => {
                              setResolvingDisputeId(dispute.id);
                              setResolutionStatus('APPROVED');
                              setDisputeResolutionText('');
                            }} 
                            className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl bg-navy-900 hover:bg-navy-800 text-white px-5 md:px-10 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-xl shadow-navy-900/10 active:scale-95 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              {initialHistory.length === 0 ? (
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-border/60 bg-surface-alt/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <History className="w-6 h-6 md:w-8 md:h-8 text-gray-300" />
                  </div>
                  <p className="text-xs md:text-sm text-text-muted font-black uppercase tracking-widest">No approval history yet</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-sm">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-alt/50 border-b border-border">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Employee</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Type</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Period</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {initialHistory.map((item: any) => (
                          <tr key={item.id} className="hover:bg-surface-alt/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold text-navy-900">{item.employee_name}</p>
                              <p className="text-[10px] text-text-muted">{item.employee_email}</p>
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                              {item.kind === 'leave' ? `${item.type} Leave` : 'WFH'}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-text-muted font-medium">
                              {item.kind === 'leave'
                                ? `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`
                                : formatDate(item.date)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
                                item.status === 'Approved' || item.status === 'Approved WFH'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 border-red-500/20'
                              )}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-text-muted font-medium whitespace-nowrap">
                              {formatSafeDate(item.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden p-3 space-y-2 bg-surface-alt/10">
                    {initialHistory.map((item: any) => (
                      <div key={item.id} className="p-3 bg-white rounded-xl border border-border/50 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-navy-900 tracking-tight">{item.employee_name}</p>
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
                            item.status === 'Approved' || item.status === 'Approved WFH'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                          )}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-text-muted font-bold uppercase tracking-wider">
                          <span>
                            {item.kind === 'leave' ? `${item.type} Leave` : 'Remote Work (WFH)'}
                          </span>
                          <span className="font-medium text-gray-400">
                            {formatSafeDate(item.created_at)}
                          </span>
                        </div>
                        <div className="text-[10px] text-navy-950/80 bg-surface-alt px-2.5 py-1.5 rounded-lg border border-border/30 font-medium">
                          {item.kind === 'leave'
                            ? `${formatDate(item.start_date)} to ${formatDate(item.end_date)}`
                            : `Date: ${formatDate(item.date)}`}
                        </div>
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
