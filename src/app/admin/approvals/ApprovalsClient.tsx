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
import { getSessionEvents } from '../attendance/actions';
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

const statusColors: Record<string, string> = {
  present: 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20',
  late: 'bg-amber-500/10 text-amber-450 border-amber-500/20',
  absent: 'bg-red-500/10 text-red-400 border-red-500/20',
  'half-day': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'pending wfh': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'approved wfh': 'bg-emerald-500/10 text-emerald-450 border-emerald-500/30',
  'rejected wfh': 'bg-red-500/10 text-red-400 border-red-500/30',
  working: 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20',
  'on break': 'bg-amber-500/10 text-amber-450 border-amber-500/20',
  'logged out': 'bg-slate-500/10 text-slate-400 border-slate-700/30',
  mobile_clocked_in: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  awaiting_desktop: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
  desktop_active: 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25',
  productive_timer_paused: 'bg-red-500/10 text-red-400 border-red-500/20',
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

  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [selectedDisputeEvents, setSelectedDisputeEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = async (dispute: any) => {
    setSelectedDispute(dispute);
    setIsDrawerOpen(true);
    setIsLoadingEvents(true);
    try {
      const events = await getSessionEvents(dispute.attendance_id);
      setSelectedDisputeEvents(events);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load session events timeline.');
      setSelectedDisputeEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

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
    <div className="space-y-6 text-slate-300">
      <div className="flex p-1 bg-[#0c1424]/40 backdrop-blur-md rounded-2xl md:rounded-[2rem] w-full md:w-fit border border-navy-800/80 shadow-sm overflow-x-auto scrollbar-none flex-nowrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.5rem] text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.2em] transition-all duration-300 whitespace-nowrap shrink-0 flex-1 md:flex-initial",
                isActive
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20 scale-[1.02]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-navy-900/40"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4", isActive ? "text-white" : "text-slate-400")} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-black leading-none",
                  isActive ? "bg-white text-primary-600" : "bg-navy-900 text-slate-350"
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
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-navy-800/80 bg-[#0c1424]/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#0c1424]/40 flex items-center justify-center mx-auto mb-4 border border-navy-800">
                    <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-slate-500" />
                  </div>
                  <p className="text-xs md:text-sm text-slate-400 font-black uppercase tracking-widest">Registry Clear: No Pending Leave Requests</p>
                </div>
              ) : (
                leaves.map((leave) => (
                  <Card key={leave.id} hover={false} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-navy-800 border-l-[6px] border-l-amber-500 shadow-sm bg-[#0c1424]/40 overflow-hidden relative group">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-10">
                      <div className="flex items-start gap-4 md:gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-navy-900 text-white flex items-center justify-center shrink-0 shadow-2xl border border-navy-850">
                          <User className="w-6 h-6 md:w-8 md:h-8 text-slate-300" />
                        </div>
                        <div className="space-y-3 md:space-y-4 w-full">
                          <div>
                            <h3 className="text-lg md:text-2xl font-black text-slate-100 tracking-tight leading-none">{leave.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2.5 md:mt-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-navy-900 border border-navy-800 text-[10px] md:text-[11px] font-bold text-slate-300 uppercase tracking-tighter">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-450" />
                                {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] md:text-[11px] font-black text-amber-400 uppercase tracking-wider md:tracking-widest">
                                {leave.type} LEAVE
                              </div>
                            </div>
                          </div>
                          {leave.reason && (
                            <div className="relative pl-4 md:pl-6 py-0.5 md:py-1">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500/20 rounded-full" />
                              <p className="text-xs md:text-sm text-slate-400 font-medium italic leading-relaxed">"{leave.reason}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 border-t border-navy-800/40 xl:border-t-0 pt-4 xl:pt-0">
                        <Button variant="outline" onClick={() => handleLeaveAction(leave.id, 'Rejected')} disabled={processing === leave.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 md:px-8 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-sm">
                          <XCircle className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Deny
                        </Button>
                        <Button onClick={() => handleLeaveAction(leave.id, 'Approved')} disabled={processing === leave.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 md:px-10 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-lg shadow-emerald-500/10 active:scale-95 transition-all">
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
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-navy-800/80 bg-[#0c1424]/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#0c1424]/40 flex items-center justify-center mx-auto mb-4 border border-navy-800">
                    <Home className="w-6 h-6 md:w-8 md:h-8 text-slate-500" />
                  </div>
                  <p className="text-xs md:text-sm text-slate-400 font-black uppercase tracking-widest">Network Clear: No Remote Work Requests</p>
                </div>
              ) : (
                wfh.map((request) => (
                  <Card key={request.id} hover={false} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-navy-800 border-l-[6px] border-l-primary-500 shadow-sm bg-[#0c1424]/40 overflow-hidden relative group text-slate-300">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-10">
                      <div className="flex items-start gap-4 md:gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-primary-500/10 text-primary-400 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-2xl">
                          <Home className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="space-y-3 md:space-y-4 w-full">
                          <div>
                            <h3 className="text-lg md:text-2xl font-black text-slate-100 tracking-tight leading-none">{request.employee_name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2.5 md:mt-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-navy-900 border border-navy-800 text-[10px] md:text-[11px] font-bold text-slate-300 uppercase tracking-tighter">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-450" />
                                {formatDate(request.date)}
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-violet-500/10 border border-violet-500/20 text-[10px] md:text-[11px] font-black text-violet-400 uppercase tracking-wider md:tracking-widest">
                                <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                {formatSafeTime(request.check_in)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy-900 text-slate-300 text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] border border-navy-800 w-fit">
                            <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 text-red-500" />
                            Geolocation Sync: {typeof request.lat === 'number' ? request.lat.toFixed(6) : (request.lat ? Number(request.lat).toFixed(6) : '0.000000')}, {typeof request.lng === 'number' ? request.lng.toFixed(6) : (request.lng ? Number(request.lng).toFixed(6) : '0.000000')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 border-t border-navy-800/40 xl:border-t-0 pt-4 xl:pt-0">
                        <Button variant="outline" onClick={() => handleWFHAction(request.id, 'Rejected WFH')} disabled={processing === request.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 md:px-8 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-sm">
                          <XCircle className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Reject
                        </Button>
                        <Button onClick={() => handleWFHAction(request.id, 'Approved WFH')} disabled={processing === request.id} className="flex-1 xl:flex-initial rounded-xl md:rounded-2xl bg-primary-500 hover:bg-primary-600 text-white px-5 md:px-10 py-3 md:py-4 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-xl active:scale-95 transition-all">
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
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-navy-800/80 bg-[#0c1424]/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#0c1424]/40 flex items-center justify-center mx-auto mb-4 border border-navy-800">
                    <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-slate-500" />
                  </div>
                  <p className="text-xs md:text-sm text-slate-400 font-black uppercase tracking-widest">Registry Clear: No Pending Attendance Disputes</p>
                </div>
              ) : (
                disputes.map((dispute) => (
                  <Card key={dispute.id} hover={false} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-navy-800 border-l-[6px] border-l-violet-500 shadow-sm bg-[#0c1424]/40 overflow-hidden relative group text-slate-350">
                    <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-stretch">
                      
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base md:text-lg font-black text-slate-100 tracking-tight leading-none">{dispute.employee_name}</h3>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium">{dispute.employee_email}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[8px] font-black bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-widest">
                            {dispute.category?.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-navy-900 text-slate-400 border border-navy-800">
                            ID: #{dispute.id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>

                        {dispute.reason && (
                          <div className="bg-navy-950/40 p-4 rounded-xl border border-navy-800/60 relative pl-5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500/30 rounded-full" />
                            <p className="text-xs text-slate-300 font-medium italic leading-relaxed">
                              <span className="font-bold text-slate-450 not-italic block text-[9px] uppercase tracking-wider mb-1">Employee Explanation:</span>
                              "{dispute.reason}"
                            </p>
                          </div>
                        )}

                        <button
                          onClick={() => handleOpenDrawer(dispute)}
                          className="px-3.5 py-1.5 bg-navy-900 hover:bg-navy-800 border border-navy-800 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <History className="w-3.5 h-3.5 text-primary-400" />
                          Inspect Timeline Ledger
                        </button>
                      </div>

                      <div className="w-full lg:w-[260px] bg-navy-950/40 p-4 rounded-xl border border-navy-800/60 flex flex-col justify-between shrink-0 space-y-4">
                        <div>
                          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-navy-800/40 pb-1 mb-2">
                            Current Projection Status
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Shift Date</span>
                              <span className="font-semibold text-slate-200">{formatSafeDate(dispute.attendance_date)}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Status</span>
                              <span className={cn(
                                "inline-flex px-1 rounded text-[8px] font-bold tracking-wider border uppercase mt-0.5",
                                statusColors[dispute.attendance_status?.toLowerCase()] || statusColors.present
                              )}>
                                {dispute.attendance_status || 'Unknown'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Clock In</span>
                              <span className="font-semibold text-slate-200">{dispute.attendance_check_in || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Clock Out</span>
                              <span className="font-semibold text-slate-200">{dispute.attendance_check_out || '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-navy-800/40 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-450 font-medium">Late Penalty:</span>
                            {dispute.attendance_is_late ? (
                              <span className="font-black text-amber-450 font-mono">+{dispute.attendance_late_minutes}m</span>
                            ) : (
                              <span className="text-slate-500 font-bold font-mono">None</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-450 font-medium">Deduction applied:</span>
                            {dispute.attendance_deduction > 0 ? (
                              <span className="bg-red-500/15 text-red-400 border border-red-500/25 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                -{dispute.attendance_deduction} Day
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold font-mono">None</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {resolvingDisputeId === dispute.id && resolutionStatus && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        className="bg-navy-950/60 p-4 rounded-xl border border-navy-800 space-y-3 mt-5"
                      >
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-350 block font-mono">
                            Compliance Justification Reason for {resolutionStatus === 'APPROVED' ? 'Approval' : 'Rejection'} (Audit Required)
                          </label>
                          <textarea
                            placeholder="Provide the administrative explanation for resolving this dispute to register in the immutable audit log..."
                            required
                            rows={2}
                            value={disputeResolutionText}
                            onChange={(e) => setDisputeResolutionText(e.target.value)}
                            className="w-full px-3 py-2 border border-navy-800 rounded-lg text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none bg-navy-900 text-slate-200 placeholder:text-slate-650"
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
                            className="px-3 py-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase"
                          >
                            Cancel
                          </button>
                          <Button
                            onClick={() => handleResolveDisputeSubmit(dispute.id, resolutionStatus)}
                            disabled={processing === dispute.id}
                            className={cn(
                              "px-4 py-1.5 text-[10px] uppercase font-bold text-white rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all",
                              resolutionStatus === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-650 hover:bg-red-700'
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

                    {resolvingDisputeId !== dispute.id && (
                      <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 border-t border-navy-800/40 mt-5 pt-4 justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setResolvingDisputeId(dispute.id);
                            setResolutionStatus('REJECTED');
                            setDisputeResolutionText('');
                          }} 
                          className="rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 md:px-8 py-2 md:py-3.5 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Deny
                        </Button>
                        <Button 
                          onClick={() => {
                            setResolvingDisputeId(dispute.id);
                            setResolutionStatus('APPROVED');
                            setDisputeResolutionText('');
                          }} 
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 md:px-10 py-2 md:py-3.5 font-black text-[10px] md:text-[11px] uppercase tracking-wider md:tracking-widest h-auto shadow-lg shadow-emerald-500/15 active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 md:mr-2" /> Approve
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              {initialHistory.length === 0 ? (
                <div className="p-12 md:p-20 text-center rounded-2xl md:rounded-[3rem] border border-dashed border-navy-800/80 bg-[#0c1424]/20">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#0c1424]/40 flex items-center justify-center mx-auto mb-4 border border-navy-800">
                    <History className="w-6 h-6 md:w-8 md:h-8 text-slate-550" />
                  </div>
                  <p className="text-xs md:text-sm text-slate-450 font-black uppercase tracking-widest">No approval history yet</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-navy-800 bg-[#0c1424]/40 overflow-hidden shadow-sm">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#090e17]/40 border-b border-navy-800/60">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Period</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-800/40">
                        {initialHistory.map((item: any) => (
                          <tr key={item.id} className="hover:bg-navy-900/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold text-slate-200">{item.employee_name}</p>
                              <p className="text-[10px] text-slate-500">{item.employee_email}</p>
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-350">
                              {item.kind === 'leave' ? `${item.type} Leave` : 'WFH'}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-slate-400 font-medium font-mono">
                              {item.kind === 'leave'
                                ? `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`
                                : formatDate(item.date)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
                                item.status === 'Approved' || item.status === 'Approved WFH'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              )}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-slate-550 font-medium whitespace-nowrap font-mono">
                              {formatSafeDate(item.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden p-3 space-y-2 bg-[#090e17]/20">
                    {initialHistory.map((item: any) => (
                      <div key={item.id} className="p-3 bg-[#0c1424]/60 rounded-xl border border-navy-800 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-200 tracking-tight">{item.employee_name}</p>
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
                            item.status === 'Approved' || item.status === 'Approved WFH'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          )}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                          <span>
                            {item.kind === 'leave' ? `${item.type} Leave` : 'Remote Work (WFH)'}
                          </span>
                          <span className="font-medium text-slate-550">
                            {formatSafeDate(item.created_at)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 bg-navy-900 px-2.5 py-1.5 rounded-lg border border-navy-850 font-medium">
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

      {isDrawerOpen && selectedDispute && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity" 
            onClick={() => {
              setIsDrawerOpen(false);
              setSelectedDispute(null);
            }}
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-[#0c1424] shadow-2xl border-l border-navy-800 z-50 flex flex-col text-slate-200"
          >
            <div className="p-4 border-b border-navy-800 flex items-center justify-between bg-navy-950/40">
              <div>
                <h3 className="font-heading font-black text-sm text-slate-100 uppercase tracking-wider">
                  Session Telemetry Details
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  {selectedDispute.employee_name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setSelectedDispute(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-navy-900 text-slate-450 hover:text-white hover:bg-navy-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="p-4 rounded-xl border border-navy-800 bg-navy-950/40 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Date</span>
                    <span className="font-semibold text-slate-200">{formatSafeDate(selectedDispute.attendance_date)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Current State</span>
                    <span className={cn(
                      "inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border uppercase mt-0.5",
                      statusColors[selectedDispute.attendance_status?.toLowerCase()] || statusColors.present
                    )}>
                      {selectedDispute.attendance_status || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Clock-In Time</span>
                    <span className="font-semibold text-slate-200">{selectedDispute.attendance_check_in || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Clock-Out Time</span>
                    <span className="font-semibold text-slate-200">{selectedDispute.attendance_check_out || '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-navy-800/40 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Late Delay</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedDispute.attendance_is_late ? `+${selectedDispute.attendance_late_minutes}m` : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Deduction Penalty</span>
                    <span className="font-mono font-bold text-red-400">
                      {selectedDispute.attendance_deduction > 0 ? `-${selectedDispute.attendance_deduction} Day` : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 relative">
                <h4 className="text-[10px] font-black text-slate-350 uppercase tracking-widest block mb-4 border-b border-navy-800/40 pb-1">
                  Immutable Telemetry Timeline
                </h4>

                {isLoadingEvents ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs font-bold gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                    <span>Retrieving event stream logs...</span>
                  </div>
                ) : selectedDisputeEvents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-bold border border-dashed border-navy-800 rounded-xl p-4 bg-navy-950/40">
                    <AlertTriangle className="w-5 h-5 text-amber-550 mx-auto mb-2" />
                    <p>No telemetry logs found for this session.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-navy-800">
                    {selectedDisputeEvents.map((evt, idx) => {
                      const date = new Date(evt.event_timestamp);
                      const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
                      
                      let dotColor = 'bg-slate-650';
                      let cardBg = 'bg-navy-900/40 border-navy-800/80';
                      let description = '';

                      switch(evt.event_type) {
                        case 'CLOCK_IN':
                          dotColor = 'bg-emerald-500 ring-4 ring-emerald-500/20';
                          cardBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
                          description = `Geofence: ${evt.payload?.within_geofence ? 'OK' : 'OUTSIDE'} (${evt.payload?.distance_meters ? Math.round(evt.payload.distance_meters) + 'm' : 'Unknown'})\nIP: ${evt.client_ip || '—'}`;
                          break;
                        case 'CLOCK_OUT':
                        case 'FORCE_LOGOUT':
                          dotColor = 'bg-red-500 ring-4 ring-red-500/20';
                          cardBg = 'bg-red-500/10 border-red-500/20 text-red-300';
                          description = `${evt.event_type === 'FORCE_LOGOUT' ? 'Admin Force Logout' : 'Self Clock Out'}\nIP: ${evt.client_ip || '—'}${evt.payload?.reason ? '\nJustification: ' + evt.payload.reason : ''}`;
                          break;
                        case 'BREAK_STARTED':
                          dotColor = 'bg-amber-500';
                          description = `Self initiated break`;
                          break;
                        case 'BREAK_ENDED':
                          dotColor = 'bg-emerald-400';
                          description = `Resumed operations${evt.payload?.reason ? '\nAdmin reversal: ' + evt.payload.reason : ''}`;
                          break;
                        case 'AUTO_BREAK_TRIGGERED':
                          dotColor = 'bg-red-500 animate-pulse ring-4 ring-red-500/10';
                          cardBg = 'bg-red-500/5 border-red-500/10';
                          description = `Automatic break enforcement (No heartbeat activity detected for 5 minutes)`;
                          break;
                        case 'IDLE_WARNING':
                          dotColor = 'bg-amber-400';
                          description = `Idle popup triggered (No telemetry for 3 minutes)`;
                          break;
                        case 'GPS_EXIT':
                          dotColor = 'bg-amber-500 ring-4 ring-amber-500/10';
                          description = `GPS coordinate change: User exited the office bounds.`;
                          break;
                        case 'GPS_REENTRY':
                          dotColor = 'bg-emerald-400';
                          description = `GPS coordinate change: User returned within geofence boundaries.`;
                          break;
                        case 'ADMIN_OVERRIDE':
                          dotColor = 'bg-violet-500 ring-4 ring-violet-500/20';
                          cardBg = 'bg-violet-500/10 border-violet-500/20 text-violet-300';
                          description = `Override: ${evt.payload?.override_field}\nFrom: ${String(evt.payload?.old_value)} → To: ${String(evt.payload?.new_value)}\nReason: ${evt.payload?.reason || '—'}`;
                          break;
                        case 'HEARTBEAT_RECEIVED':
                          dotColor = 'bg-blue-400';
                          const clicks = evt.payload?.clicks_count ?? evt.payload?.telemetry?.clicks ?? 0;
                          const keys = evt.payload?.keys_count ?? evt.payload?.telemetry?.keys ?? 0;
                          description = `Heartbeat check secure. Keyboard/Mouse telemetry: ${clicks} clicks, ${keys} keystrokes.`;
                          break;
                      }

                      return (
                        <div key={evt.id || idx} className="relative group/item">
                          <div className={cn(
                            "absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border border-navy-950 z-10",
                            dotColor
                          )} />
                          
                          <div className={cn("p-3 rounded-xl border text-xs shadow-sm space-y-1", cardBg)}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-100 tracking-tight">{evt.event_type}</span>
                              <span className="text-[10px] font-mono text-slate-500">{timeStr}</span>
                            </div>
                            <p className="text-[10px] text-slate-350 whitespace-pre-line leading-relaxed">
                              {description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-navy-800 bg-[#090e17]/80 text-[10px] text-slate-450 uppercase tracking-widest text-center font-bold">
              🔒 Immutable Ledger Audit Active
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
