'use client';

import { useState, useRef } from 'react';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { 
  Calendar, Home, 
  MapPin, User, Loader2, 
  ShieldCheck, History, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { updateLeaveStatus, updateWFHStatus, resolveDispute } from './actions';
import { getSessionEvents } from '../attendance/actions';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';
import { updateWFHRequestStatus, type AdminWFHRequest } from '../wfh/actions';

type Tab = 'leaves' | 'wfh' | 'wfhRequests' | 'disputes' | 'history';

const formatSafeTime = (timeStr: string | number | Date | null | undefined) => {
  if (!timeStr) return '--:--';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
};

const formatSafeDate = (dateStr: string | number | Date | null | undefined) => {
  if (!dateStr) return '-- --- ----';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// statusColors map removed and replaced with standard StatusBadge component

export interface LeaveRequestApproval {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

export interface WFHRequestApproval {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  date: string;
  check_in: string | null;
  lat: number;
  lng: number;
  status: string;
}

export interface DisputeApproval {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  category: string;
  reason: string;
  attendance_id: string;
  attendance_date: string;
  attendance_status: string;
  attendance_check_in: string | null;
  attendance_check_out: string | null;
  attendance_is_late: boolean;
  attendance_late_minutes: number;
  attendance_deduction: number;
  attendance_productive_hours: number;
  attendance_total_break_seconds: number;
  attendance_duration_hours?: number;
}

export interface ApprovalHistoryItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  kind: 'leave' | 'wfh';
  type?: string;
  start_date?: string;
  end_date?: string;
  date?: string;
  status: string;
  created_at: string;
}

export interface DisputeEventTimeline {
  id: string;
  event_type: string;
  event_timestamp: string;
  payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  client_ip?: string | null;
}

export default function ApprovalsClient({ 
  initialLeaves, 
  initialWFH,
  initialWFHRequests = [],
  initialHistory,
  initialDisputes = [],
}: { 
  initialLeaves: LeaveRequestApproval[];
  initialWFH: WFHRequestApproval[];
  initialWFHRequests?: AdminWFHRequest[];
  initialHistory: ApprovalHistoryItem[];
  initialDisputes?: DisputeApproval[];
}) {
  const [leaves, setLeaves] = useState<LeaveRequestApproval[]>(initialLeaves);
  const [wfh, setWfh] = useState<WFHRequestApproval[]>(initialWFH);
  const [wfhRequests, setWfhRequests] = useState<AdminWFHRequest[]>(initialWFHRequests);
  const [disputes, setDisputes] = useState<DisputeApproval[]>(initialDisputes);
  const [activeTab, setActiveTab] = useState<Tab>('leaves');
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const [disputeResolutionText, setDisputeResolutionText] = useState('');
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const [selectedDispute, setSelectedDispute] = useState<DisputeApproval | null>(null);
  const [selectedDisputeEvents, setSelectedDisputeEvents] = useState<DisputeEventTimeline[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(drawerRef, isDrawerOpen, () => {
    setIsDrawerOpen(false);
    setSelectedDispute(null);
  });

  const handleOpenDrawer = async (dispute: DisputeApproval) => {
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
    } catch {
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
    } catch {
      toast.error('Failed to update remote work request status.');
    } finally {
      setProcessing(null);
    }
  };

  const handleWFHRequestAction = async (id: string, status: 'Approved' | 'Rejected') => {
    setProcessing(id);
    try {
      const res = await updateWFHRequestStatus(id, status);
      if (res && !res.success) {
        toast.error(res.error || 'Failed to update remote work request status.');
      } else {
        setWfhRequests(prev => prev.filter(w => w.id !== id));
        toast.success(`Remote work request ${status === 'Approved' ? 'approved' : 'rejected'} successfully.`);
      }
    } catch {
      toast.error('Failed to update remote work request status.');
    } finally {
      setProcessing(null);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'leaves', label: 'Time Off', icon: Calendar, count: leaves.length || undefined },
    { id: 'wfh', label: 'Daily WFH', icon: Home, count: wfh.length || undefined },
    { id: 'wfhRequests', label: 'WFH Requests', icon: Calendar, count: wfhRequests.length || undefined },
    { id: 'disputes', label: 'Disputes Queue', icon: AlertTriangle, count: disputes.length || undefined },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-6 text-zinc-650 font-sans">
      {/* Vercel-style Tab Navigation Bar */}
      <div className="flex border-b border-zinc-200 overflow-x-auto scrollbar-none relative gap-2 flex-nowrap w-full">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3.5 border-b-2 text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer",
                isActive
                  ? "border-primary-500 text-primary-600 font-bold"
                  : "border-transparent text-zinc-450 hover:text-zinc-700"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-navy-900" : "text-zinc-400")} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none",
                  isActive ? "bg-navy-900 text-white" : "bg-zinc-100 text-zinc-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'leaves' && (
            <motion.div key="leaves" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {leaves.length === 0 ? (
                <div className="p-12 text-center rounded-lg border border-dashed border-zinc-250 bg-white">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3 border border-zinc-200">
                    <ShieldCheck className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">Registry Clear: No Pending Leave Requests</p>
                  <p className="text-[11px] text-zinc-450 mt-0.5">All time-off requests have been reviewed.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs divide-y divide-zinc-150 overflow-hidden">
                  {leaves.map((leave) => (
                    <div key={leave.id} className="p-4 hover:bg-zinc-50/80 transition-all duration-200 text-zinc-600 border-l-4 border-l-primary-500 pl-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-zinc-500" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-navy-900">{leave.employee_name}</span>
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-semibold border uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200">
                                {leave.type} Leave
                              </span>
                              <span className="text-[10px] text-zinc-450 font-mono">
                                {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                              </span>
                            </div>
                            {leave.reason && (
                              <p className="text-xs text-zinc-500 font-medium italic mt-0.5">&quot;{leave.reason}&quot;</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleLeaveAction(leave.id, 'Rejected')} 
                            disabled={processing === leave.id} 
                            className="border-red-200 text-red-600 hover:bg-red-55 py-1 px-2.5 rounded-md text-[9px] font-bold cursor-pointer uppercase tracking-wider"
                          >
                            Deny
                          </Button>
                          <Button 
                            variant="primary"
                            size="sm" 
                            onClick={() => handleLeaveAction(leave.id, 'Approved')} 
                            disabled={processing === leave.id} 
                            className="text-[9px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-md cursor-pointer"
                          >
                            {processing === leave.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Authorize'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'wfh' && (
            <motion.div key="wfh" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {wfh.length === 0 ? (
                <div className="p-12 text-center rounded-lg border border-dashed border-zinc-250 bg-white">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3 border border-zinc-200">
                    <Home className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">Network Clear: No Remote Work Requests</p>
                  <p className="text-[11px] text-zinc-450 mt-0.5">No pending remote WFH approvals found.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs divide-y divide-zinc-150 overflow-hidden">
                  {wfh.map((request) => (
                    <div key={request.id} className="p-4 hover:bg-zinc-50/80 transition-all duration-200 text-zinc-655 border-l-4 border-l-blue-500 pl-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-md bg-primary-50/50 border border-primary-200/50 text-primary-600 flex items-center justify-center shrink-0">
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-navy-900">{request.employee_name}</span>
                              <span className="text-[10px] text-zinc-450 font-mono">
                                {formatDate(request.date)} · Check-In: {formatSafeTime(request.check_in)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-450 uppercase tracking-wider mt-0.5">
                              <MapPin className="w-3 h-3 text-red-500" />
                              Geolocation: {typeof request.lat === 'number' ? request.lat.toFixed(6) : (request.lat ? Number(request.lat).toFixed(6) : '0.000000')}, {typeof request.lng === 'number' ? request.lng.toFixed(6) : (request.lng ? Number(request.lng).toFixed(6) : '0.000000')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleWFHAction(request.id, 'Rejected WFH')} 
                            disabled={processing === request.id} 
                            className="border-red-200 text-red-600 hover:bg-red-55 py-1 px-2.5 rounded-md text-[9px] font-bold cursor-pointer uppercase tracking-wider"
                          >
                            Reject
                          </Button>
                          <Button 
                            variant="primary"
                            size="sm" 
                            onClick={() => handleWFHAction(request.id, 'Approved WFH')} 
                            disabled={processing === request.id} 
                            className="text-[9px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-md cursor-pointer"
                          >
                            {processing === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Authorize'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'wfhRequests' && (
            <motion.div key="wfhRequests" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {wfhRequests.length === 0 ? (
                <div className="p-12 text-center rounded-lg border border-dashed border-zinc-250 bg-white">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3 border border-zinc-200">
                    <Calendar className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">Queue Clear: No WFH Requests</p>
                  <p className="text-[11px] text-zinc-450 mt-0.5">All pre-planned WFH requests have been processed.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs divide-y divide-zinc-150 overflow-hidden">
                  {wfhRequests.map((request) => (
                    <div key={request.id} className="p-4 hover:bg-zinc-50/80 transition-all duration-200 text-zinc-655 border-l-4 border-l-indigo-500 pl-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-md bg-primary-50/50 border border-primary-200/50 text-primary-600 flex items-center justify-center shrink-0">
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-navy-900">{request.employee_name}</span>
                              <span className="text-[10px] text-zinc-450 font-mono">
                                {formatDate(request.start_date)} — {formatDate(request.end_date)}
                              </span>
                            </div>
                            {request.reason && (
                              <p className="text-xs text-zinc-500 font-medium italic mt-0.5">&quot;{request.reason}&quot;</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleWFHRequestAction(request.id, 'Rejected')} 
                            disabled={processing === request.id} 
                            className="border-red-200 text-red-600 hover:bg-red-55 py-1 px-2.5 rounded-md text-[9px] font-bold cursor-pointer uppercase tracking-wider"
                          >
                            Deny
                          </Button>
                          <Button 
                            variant="primary"
                            size="sm" 
                            onClick={() => handleWFHRequestAction(request.id, 'Approved')} 
                            disabled={processing === request.id} 
                            className="text-[9px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-md cursor-pointer"
                          >
                            {processing === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Authorize'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'disputes' && (
            <motion.div key="disputes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {disputes.length === 0 ? (
                <div className="p-12 text-center rounded-lg border border-dashed border-zinc-250 bg-white">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3 border border-zinc-200">
                    <ShieldCheck className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">Registry Clear: No Pending Attendance Disputes</p>
                  <p className="text-[11px] text-zinc-450 mt-0.5">All attendance correction disputes resolved.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs divide-y divide-zinc-150 overflow-hidden">
                  {disputes.map((dispute) => (
                    <div key={dispute.id} className="p-4 hover:bg-zinc-50/80 transition-all duration-200 text-zinc-655 border-l-4 border-l-violet-500 pl-5">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-md bg-violet-50 border border-violet-100 text-violet-500 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="font-bold text-navy-900">{dispute.employee_name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-100 text-violet-700 border border-violet-200 uppercase tracking-widest font-mono">
                                  {dispute.category?.replace('_', ' ')}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-mono">
                                  ID: #{dispute.id.substring(0, 8).toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-450 font-mono font-medium">{dispute.employee_email}</p>
                            </div>
                          </div>
                          
                          {dispute.reason && (
                            <div className="bg-zinc-50/40 p-2.5 rounded-md border border-zinc-200/60 relative pl-4 text-xs">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-400 rounded-full" />
                              <p className="text-zinc-700 font-medium italic">
                                <span className="font-bold text-zinc-500 not-italic block text-[8px] uppercase tracking-wider mb-0.5">Employee Explanation:</span>
                                &quot;{dispute.reason}&quot;
                              </p>
                            </div>
                          )}

                          <button
                            onClick={() => handleOpenDrawer(dispute)}
                            className="px-2.5 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-md text-[9px] font-bold uppercase tracking-wider text-zinc-750 hover:text-navy-900 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                          >
                            <History className="w-3 h-3 text-primary-500" />
                            Inspect Timeline Ledger
                          </button>
                        </div>

                        <div className="w-full md:w-[240px] bg-zinc-50/50 p-3 rounded-md border border-zinc-200/60 flex flex-col justify-between shrink-0 text-xs gap-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Shift Date</span>
                              <span className="font-semibold text-navy-900">{formatSafeDate(dispute.attendance_date)}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Status</span>
                              <StatusBadge status={dispute.attendance_status || 'Unknown'} className="mt-0.5 text-[8px] px-1.5 py-0.5 font-bold" />
                            </div>
                            <div>
                              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Clock In</span>
                              <span className="font-semibold text-navy-900 font-mono">{dispute.attendance_check_in ? formatSafeTime(dispute.attendance_check_in) : '—'}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Clock Out</span>
                              <span className="font-semibold text-navy-900 font-mono">{dispute.attendance_check_out ? formatSafeTime(dispute.attendance_check_out) : '—'}</span>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-zinc-200/60 flex justify-between items-center text-[9px] font-mono">
                            <div className="flex flex-col text-zinc-550 font-semibold">
                              <span>Late Penalty:</span>
                              <span>Deduction:</span>
                              <span>Productive:</span>
                              <span>Break Time:</span>
                            </div>
                            <div className="flex flex-col items-end">
                              {dispute.attendance_is_late ? (
                                <span className="font-bold text-amber-600">+{dispute.attendance_late_minutes}m</span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                              {dispute.attendance_deduction > 0 ? (
                                <span className="bg-red-50 text-red-650 border border-red-200 px-1 rounded font-bold uppercase tracking-wider">
                                  -{dispute.attendance_deduction} Day
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                              <span className="font-bold text-navy-900">
                                {dispute.attendance_productive_hours !== undefined ? `${dispute.attendance_productive_hours.toFixed(1)}h` : `${dispute.attendance_duration_hours?.toFixed(1) || '—'}h`}
                              </span>
                              <span className="font-bold text-navy-900">
                                {dispute.attendance_total_break_seconds !== undefined ? `${Math.round(dispute.attendance_total_break_seconds / 60)}m` : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col justify-end gap-2 shrink-0 self-end md:self-center">
                          {resolvingDisputeId !== dispute.id && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setResolvingDisputeId(dispute.id);
                                  setResolutionStatus('REJECTED');
                                  setDisputeResolutionText('');
                                }} 
                                className="border-red-200 text-red-600 hover:bg-red-55 py-1 px-2.5 rounded-md text-[9px] font-bold cursor-pointer uppercase tracking-wider"
                              >
                                Deny
                              </Button>
                              <Button 
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setResolvingDisputeId(dispute.id);
                                  setResolutionStatus('APPROVED');
                                  setDisputeResolutionText('');
                                }} 
                                className="text-[9px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-md cursor-pointer"
                              >
                                Approve
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {resolvingDisputeId === dispute.id && resolutionStatus && (
                        <div className="bg-zinc-50/60 p-3 rounded-md border border-zinc-200 space-y-3 mt-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 block font-mono">
                              Compliance Justification Reason for {resolutionStatus === 'APPROVED' ? 'Approval' : 'Rejection'} (Audit Required)
                            </label>
                            <textarea
                              placeholder="Provide the administrative explanation for resolving this dispute..."
                              required
                              rows={2}
                              value={disputeResolutionText}
                              onChange={(e) => setDisputeResolutionText(e.target.value)}
                              className="w-full px-3 py-2 border border-zinc-200 rounded-md text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white text-navy-900 placeholder:text-zinc-400 font-semibold"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResolvingDisputeId(null);
                                setResolutionStatus(null);
                                setDisputeResolutionText('');
                              }}
                              className="text-[9px] font-bold text-zinc-500 hover:text-navy-950 uppercase border-zinc-200 px-2.5 py-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleResolveDisputeSubmit(dispute.id, resolutionStatus)}
                              disabled={processing === dispute.id}
                              className={cn(
                                "text-[9px] uppercase font-bold text-white",
                                resolutionStatus === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' : 'bg-red-650 hover:bg-red-700 focus:ring-red-500'
                              )}
                            >
                              {processing === dispute.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                `Confirm ${resolutionStatus === 'APPROVED' ? 'Approval' : 'Denial'}`
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {initialHistory.length === 0 ? (
                <div className="p-12 text-center rounded-lg border border-dashed border-zinc-250 bg-white">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-3 border border-zinc-200 shadow-2xs">
                    <History className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">No approval history yet</p>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-650 border-b border-zinc-200">
                          <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Employee</th>
                          <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Type</th>
                          <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Period</th>
                          <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Status</th>
                          <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-right">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150">
                        {initialHistory.map((item: ApprovalHistoryItem) => (
                          <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group text-zinc-650">
                            <td className="p-4 whitespace-nowrap">
                              <p className="text-xs font-bold text-navy-900 tracking-tight font-sans">{item.employee_name}</p>
                              <p className="text-[9px] text-zinc-450 font-mono">{item.employee_email}</p>
                            </td>
                            <td className="p-4 whitespace-nowrap text-xs font-semibold text-navy-900 uppercase">
                              {item.kind === 'leave' ? `${item.type} Leave` : 'WFH'}
                            </td>
                            <td className="p-4 whitespace-nowrap text-[10px] text-zinc-500 font-medium font-mono">
                              {item.kind === 'leave'
                                ? `${formatDate(item.start_date || '')} — ${formatDate(item.end_date || '')}`
                                : formatDate(item.date || '')}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <StatusBadge status={item.status} className="text-[8px] px-2 py-0.5 rounded-full" />
                            </td>
                            <td className="p-4 whitespace-nowrap text-[9px] text-zinc-450 font-mono text-right">
                              {formatSafeDate(item.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden divide-y divide-zinc-150">
                    {initialHistory.map((item: ApprovalHistoryItem) => (
                      <div key={item.id} className="p-4 hover:bg-zinc-50/50 transition-colors space-y-2 text-zinc-650">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-navy-900 tracking-tight">{item.employee_name}</p>
                          <StatusBadge status={item.status} className="text-[8px] px-2 py-0.5 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-zinc-450 font-bold uppercase tracking-wider font-mono">
                          <span>
                            {item.kind === 'leave' ? `${item.type} Leave` : 'Remote Work (WFH)'}
                          </span>
                          <span className="font-medium text-zinc-400">
                            {formatSafeDate(item.created_at)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-600 bg-zinc-50 px-2.5 py-1.5 rounded border border-zinc-200/60 font-semibold font-mono">
                          {item.kind === 'leave'
                            ? `${formatDate(item.start_date || '')} to ${formatDate(item.end_date || '')}`
                            : `Date: ${formatDate(item.date || '')}`}
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
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col text-navy-900"
          >
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/40">
              <div>
                <h3 className="font-bold text-sm text-navy-900 uppercase tracking-wider">
                  Session Telemetry Details
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
                  {selectedDispute.employee_name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setSelectedDispute(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-zinc-500 hover:text-navy-900 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Date</span>
                    <span className="font-semibold text-navy-900">{formatSafeDate(selectedDispute.attendance_date)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Current State</span>
                    <StatusBadge status={selectedDispute.attendance_status || 'Unknown'} className="mt-0.5 text-[8px] px-1.5 py-0.5 font-bold" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Clock-In Time</span>
                    <span className="font-semibold text-navy-900">{selectedDispute.attendance_check_in ? formatSafeTime(selectedDispute.attendance_check_in) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Clock-Out Time</span>
                    <span className="font-semibold text-navy-900">{selectedDispute.attendance_check_out ? formatSafeTime(selectedDispute.attendance_check_out) : '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200/40 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Late Delay</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedDispute.attendance_is_late ? `+${selectedDispute.attendance_late_minutes}m` : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Deduction Penalty</span>
                    <span className="font-mono font-bold text-red-400">
                      {selectedDispute.attendance_deduction > 0 ? `-${selectedDispute.attendance_deduction} Day` : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 relative">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-4 border-b border-zinc-200/40 pb-1">
                  Immutable Telemetry Timeline
                </h4>

                {isLoadingEvents ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-400 text-xs font-bold gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                    <span>Retrieving event stream logs...</span>
                  </div>
                ) : selectedDisputeEvents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 font-bold border border-dashed border-zinc-200 rounded-md p-4 bg-zinc-50/40">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p>No telemetry logs found for this session.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200">
                    {selectedDisputeEvents.map((evt, idx) => {
                      const date = new Date(evt.event_timestamp);
                      const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
                      
                      let dotColor = 'bg-slate-650';
                      let cardBg = 'bg-zinc-50 border-zinc-200 text-zinc-700';
                      let description = '';

                      switch(evt.event_type) {
                        case 'CLOCK_IN':
                          dotColor = 'bg-emerald-500 ring-4 ring-emerald-500/20';
                          cardBg = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                          description = `Geofence: ${evt.payload?.within_geofence ? 'OK' : 'OUTSIDE'} (${evt.payload?.distance_meters ? Math.round(evt.payload.distance_meters) + 'm' : 'Unknown'})\nIP: ${evt.client_ip || '—'}`;
                          break;
                        case 'CLOCK_OUT':
                        case 'FORCE_LOGOUT':
                          dotColor = 'bg-red-500 ring-4 ring-red-500/20';
                          cardBg = 'bg-red-50 border-red-100 text-red-800';
                          if (evt.event_type === 'FORCE_LOGOUT' && evt.payload?.forced_by === 'system_sweeper') {
                            const staleReason = evt.payload?.stale_reason === 'heartbeat_timeout' ? 'Heartbeat Timeout' 
                              : evt.payload?.stale_reason === 'session_exceeded_16h' ? 'Session Exceeded 16h'
                              : evt.payload?.stale_reason === 'desktop_grace_expired' ? 'Desktop Grace Expired'
                              : evt.payload?.stale_reason === 'cross_shift_boundary' ? 'Cross-Shift Boundary'
                              : evt.payload?.stale_reason || 'Unknown';
                            const staleDuration = evt.payload?.stale_duration_seconds 
                              ? `${Math.round(evt.payload.stale_duration_seconds / 60)}min inactive` 
                              : '';
                            description = `⚡ System Inactivity Auto-Logout\nReason: ${staleReason}${staleDuration ? '\nInactivity: ' + staleDuration : ''}${evt.payload?.last_heartbeat_at ? '\nLast Heartbeat: ' + new Date(evt.payload.last_heartbeat_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : ''}`;
                          } else if (evt.event_type === 'FORCE_LOGOUT') {
                            description = `Admin Force Logout\nIP: ${evt.client_ip || '—'}${evt.payload?.reason ? '\nJustification: ' + evt.payload.reason : ''}`;
                          } else {
                            description = `Self Clock Out\nIP: ${evt.client_ip || '—'}${evt.payload?.reason ? '\nJustification: ' + evt.payload.reason : ''}`;
                          }
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
                          cardBg = 'bg-red-50 border-red-100 text-red-800';
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
                          cardBg = 'bg-violet-50 border-violet-100 text-violet-800';
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
                            "absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border border-white z-10",
                            dotColor
                          )} />
                          
                          <div className={cn("p-3 rounded-md border text-xs shadow-2xs space-y-1", cardBg)}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-navy-900 tracking-tight">{evt.event_type}</span>
                              <span className="text-[10px] font-mono text-zinc-400">{timeStr}</span>
                            </div>
                            <p className="text-[10px] text-zinc-650 whitespace-pre-line leading-relaxed">
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

            <div className="p-4 border-t border-zinc-200 bg-zinc-50/80 text-[10px] text-zinc-500 uppercase tracking-widest text-center font-bold">
              🔒 Immutable Ledger Audit Active
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
