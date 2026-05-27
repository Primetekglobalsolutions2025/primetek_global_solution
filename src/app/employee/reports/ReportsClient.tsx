'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Calendar, ClipboardList, ShieldCheck,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  Laptop, Wifi, WifiOff, LogIn, LogOut, Coffee,
  ChevronDown, ChevronUp, Info, Sparkles, BarChart2,
  FileText, User, MapPin, Activity,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import Card from '@/components/ui/Card';

type Tab = 'attendance' | 'leaves' | 'daily' | 'security';

interface Props {
  attendance: any;
  leaves: any;
  dailyReports: any;
  security: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; bg: string;
}) {
  return (
    <div className={cn(
      'rounded-xl p-5 border flex flex-col gap-3 relative overflow-hidden group',
      'hover:-translate-y-1 hover:shadow-md hover:shadow-navy-900/5 transition-all duration-300',
      bg
    )}>
      {/* Decorative background shape that matches the text color theme */}
      <div className={cn('absolute -right-6 -bottom-6 w-20 h-20 opacity-[0.04] rounded-full group-hover:scale-125 transition-transform duration-500', color.replace('text-', 'bg-'))} />
      
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105',
        color, 
        'bg-white/80 backdrop-blur-sm border border-white/50 shadow-xs'
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-black text-navy-900 leading-none font-heading tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-text-muted font-bold mt-0.5">{sub}</p>}
        <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mt-1.5">{label}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-1.5 h-6 bg-gradient-to-b from-primary-400 to-primary-600 rounded-full" />
      <div>
        <h3 className="font-bold text-navy-900 text-base tracking-tight font-heading">{title}</h3>
        {sub && <p className="text-[10px] text-text-muted font-bold mt-0.5 tracking-wide">{sub}</p>}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border shadow-2xs',
      level === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
      level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
      'bg-emerald-50 text-emerald-700 border-emerald-200'
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full mr-1.5 shrink-0',
        level === 'high' ? 'bg-red-500' :
        level === 'medium' ? 'bg-amber-500' :
        'bg-emerald-500'
      )} />
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const getTheme = () => {
    if (['approved', 'logged out', 'approved wfh'].includes(s)) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    }
    if (['pending', 'pending wfh', 'working'].includes(s)) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    if (['rejected', 'rejected wfh', 'absent'].includes(s)) {
      return { bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
    }
    if (s === 'on break') {
      return { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    }
    return { bg: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-500' };
  };

  const theme = getTheme();
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border shadow-2xs',
      theme.bg
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', theme.dot)} />
      {status}
    </span>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceReport({ data }: { data: any }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!data) return <p className="text-sm text-text-muted p-4">Failed to load attendance data.</p>;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Days Present" value={data.present} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-500/5 border-emerald-500/15" />
        <StatCard label="Late Entries" value={data.late} sub="Unexempted" icon={AlertTriangle} color="text-amber-600" bg="bg-amber-500/5 border-amber-500/15" />
        <StatCard label="Absences" value={data.absent} icon={XCircle} color="text-red-600" bg="bg-red-500/5 border-red-500/15" />
        <StatCard label="WFH Days" value={data.wfh} sub={data.pendingWfh > 0 ? `${data.pendingWfh} pending` : undefined} icon={MapPin} color="text-violet-600" bg="bg-violet-500/5 border-violet-500/15" />
      </div>

      {/* Hours Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-white p-5 space-y-1.5 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-300">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted leading-none">Total Productive Hours</p>
          <p className="text-3xl font-black text-navy-900 font-heading">{data.totalProductiveHours}<span className="text-sm font-semibold text-text-muted ml-1 font-sans">hrs</span></p>
          <p className="text-[10px] text-text-muted font-medium">Avg {data.avgProductiveHours} hrs/day</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-5 space-y-1.5 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-300">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted leading-none">Total Break Time</p>
          <p className="text-3xl font-black text-navy-900 font-heading">{formatSeconds(data.totalBreakSeconds)}</p>
          <p className="text-[10px] text-text-muted font-medium">Across {data.present} working days</p>
        </div>
        <div className={cn(
          'rounded-xl border p-5 space-y-1.5 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-300',
          data.deductionTotal > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white border-border/60'
        )}>
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted leading-none">Attendance Deductions</p>
          <p className={cn('text-3xl font-black font-heading', data.deductionTotal > 0 ? 'text-red-600' : 'text-navy-900')}>
            {data.deductionTotal}<span className="text-sm font-semibold text-text-muted ml-1 font-sans">days</span>
          </p>
          <p className="text-[10px] text-text-muted font-medium">{data.late} late login{data.late !== 1 ? 's' : ''} this month</p>
        </div>
      </div>

      {/* Daily Log Table */}
      <div>
        <SectionHeader title="Daily Attendance Log" sub="This month's full record" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-2xs">
          {data.records.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-xs font-bold">No records this month.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.records.map((r: any) => {
                const isExpanded = expandedRow === r.id;
                const checkIn = r.check_in ? new Date(r.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
                const checkOut = r.check_out ? new Date(r.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
                const isExempted = r.late_approved || r.permission_approved || r.shift_override || r.manager_exemption;
                return (
                  <div key={r.id} className="group/row">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-alt/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-alt border border-border/40 flex flex-col items-center justify-center shrink-0 group-hover/row:border-primary-400 transition-colors">
                        <span className="text-sm font-black text-navy-900 leading-none">{new Date(r.date).getDate()}</span>
                        <span className="text-[8px] font-bold text-text-muted uppercase mt-0.5">{new Date(r.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-navy-900">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                          <StatusBadge status={r.status} />
                          {r.is_late && !isExempted && <span className="text-[8px] font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Late {r.late_minutes}m</span>}
                          {r.is_late && isExempted && <span className="text-[8px] font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Exempted</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted font-medium">
                          <span className="flex items-center gap-1"><LogIn className="w-3 h-3 text-emerald-500" />{checkIn}</span>
                          <span className="flex items-center gap-1"><LogOut className="w-3 h-3 text-red-400" />{checkOut}</span>
                          {r.productive_hours > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.productive_hours}h productive</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-gray-400 transition-transform duration-200">
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1.5 bg-surface-alt/25 border-t border-border/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div className="bg-white p-3 rounded-lg border border-border/40 shadow-2xs">
                              <p className="text-[9px] text-text-muted uppercase tracking-wider font-black mb-0.5">Break Time</p>
                              <p className="font-bold text-navy-900 text-sm mt-1">{formatSeconds(r.total_break_seconds)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-border/40 shadow-2xs">
                              <p className="text-[9px] text-text-muted uppercase tracking-wider font-black mb-0.5">Productive</p>
                              <p className="font-bold text-navy-900 text-sm mt-1">{r.productive_hours}h</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-border/40 shadow-2xs">
                              <p className="text-[9px] text-text-muted uppercase tracking-wider font-black mb-0.5">Deduction</p>
                              <p className={cn('font-bold text-sm mt-1', r.deduction_applied > 0 ? 'text-red-600' : 'text-navy-900')}>{r.deduction_applied > 0 ? `${r.deduction_applied} day` : 'None'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-border/40 shadow-2xs">
                              <p className="text-[9px] text-text-muted uppercase tracking-wider font-black mb-0.5">Exemption</p>
                              <p className="font-bold text-navy-900 text-sm mt-1">{isExempted ? 'Yes' : 'No'}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Leaves Tab ───────────────────────────────────────────────────────────────

function LeavesReport({ data }: { data: any }) {
  if (!data) return <p className="text-sm text-text-muted p-4">Failed to load leave data.</p>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={data.total} icon={Calendar} color="text-blue-600" bg="bg-blue-500/5 border-blue-500/15" />
        <StatCard label="Approved" value={data.approved} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-500/5 border-emerald-500/15" />
        <StatCard label="Pending" value={data.pending} icon={AlertTriangle} color="text-amber-600" bg="bg-amber-500/5 border-amber-500/15" />
        <StatCard label="Rejected" value={data.rejected} icon={XCircle} color="text-red-600" bg="bg-red-500/5 border-red-500/15" />
      </div>

      {/* Casual Leave Balance */}
      <div className="rounded-xl border border-border/60 bg-white p-5 shadow-2xs">
        <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-3">Casual Leave Balance — This Month</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            <p className="text-4xl font-black text-navy-900 font-heading">{data.remainingCasual}<span className="text-base font-semibold text-text-muted ml-1 font-sans">/ 1 day</span></p>
            <p className="text-[10px] text-text-muted font-bold mt-1">{data.usedCasual} used this month</p>
          </div>
          <div className="flex-1 h-3 rounded-full bg-surface-alt overflow-hidden border border-border/40 shadow-inner">
            <div
              className={cn('h-full rounded-full transition-all bg-gradient-to-r', data.usedCasual >= 1 ? 'from-red-400 to-red-600' : 'from-emerald-400 to-emerald-600')}
              style={{ width: `${Math.min(100, (data.usedCasual / 1) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Leave History */}
      <div>
        <SectionHeader title="Leave Request History" sub="All time" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-2xs">
          {data.leaves.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-xs font-bold">No leave requests found.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.leaves.map((l: any) => (
                <div key={l.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-surface-alt/30 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-navy-900">{l.type} Leave</span>
                      <StatusBadge status={l.status || 'Pending'} />
                    </div>
                    <p className="text-[10px] text-text-muted font-bold tracking-wide uppercase">
                      {formatDate(l.start_date)} — {formatDate(l.end_date)}
                    </p>
                    {l.reason && (
                      <p className="text-[10px] text-text-secondary italic bg-surface-alt/40 px-3 py-1.5 rounded-lg border-l-2 border-primary-500/60 max-w-sm mt-1.5 leading-relaxed">
                        &ldquo;{l.reason}&rdquo;
                      </p>
                    )}
                  </div>
                  <p className="text-[9px] text-text-muted font-bold shrink-0 text-right">
                    {new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Daily Reports Tab ────────────────────────────────────────────────────────

function DailyReportsReport({ data }: { data: any }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!data) return <p className="text-sm text-text-muted p-4">Failed to load daily report data.</p>;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Days Reported" value={data.daysReported} icon={ClipboardList} color="text-primary-600" bg="bg-primary-500/5 border-primary-500/15" />
        <StatCard label="Total Applications" value={data.totalApplications} icon={FileText} color="text-blue-600" bg="bg-blue-500/5 border-blue-500/15" />
        <StatCard label="Interviews Scheduled" value={data.totalInterviews} icon={User} color="text-violet-600" bg="bg-violet-500/5 border-violet-500/15" />
        <StatCard label="Assessments" value={data.totalAssessments} icon={Activity} color="text-emerald-600" bg="bg-emerald-500/5 border-emerald-500/15" />
      </div>

      {/* Submission Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Technical Rounds', value: data.totalTechnical, color: 'text-cyan-600' },
          { label: 'Non-Technical', value: data.totalNonTechnical, color: 'text-indigo-600' },
          { label: 'Self Submissions', value: data.totalSelfSub, color: 'text-teal-600' },
          { label: 'Support Submissions', value: data.totalSupportSub, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-white p-4.5 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-300">
            <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-1.5 leading-none">{s.label}</p>
            <p className={cn('text-2xl font-black font-heading leading-none mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Daily Log */}
      <div>
        <SectionHeader title="Daily Report Log" sub="This month's submissions" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-2xs">
          {data.records.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-xs font-bold">No reports submitted this month.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.records.map((r: any) => {
                const isExpanded = expandedRow === r.id;
                const total = r.applications_count + r.interviews_count + r.assessments + r.technical_rounds + r.non_technical + r.self_submissions + r.support_submissions;
                return (
                  <div key={r.id} className="group/row">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-alt/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-alt border border-border/40 flex flex-col items-center justify-center shrink-0 group-hover/row:border-primary-400 transition-colors">
                        <span className="text-sm font-black text-navy-900 leading-none">{new Date(r.report_date).getDate()}</span>
                        <span className="text-[8px] font-bold text-text-muted uppercase mt-0.5">{new Date(r.report_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-navy-900">{r.client_name}</p>
                        <p className="text-[10px] text-text-muted font-medium mt-0.5">{total} total activities · {r.applications_count} apps · {r.interviews_count} interviews</p>
                      </div>
                      <div className="shrink-0 text-gray-400">
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1.5 bg-surface-alt/25 border-t border-border/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            {[
                              { label: 'Applications', value: r.applications_count },
                              { label: 'Interviews', value: r.interviews_count },
                              { label: 'Assessments', value: r.assessments },
                              { label: 'Technical', value: r.technical_rounds },
                              { label: 'Non-Technical', value: r.non_technical },
                              { label: 'Self Submissions', value: r.self_submissions },
                              { label: 'Support Submissions', value: r.support_submissions },
                            ].map(f => (
                              <div key={f.label} className="bg-white p-3 rounded-lg border border-border/40 shadow-2xs">
                                <p className="text-[9px] text-text-muted uppercase tracking-wider font-black mb-0.5">{f.label}</p>
                                <p className="font-bold text-navy-900 text-sm mt-1">{f.value}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityReport({ data }: { data: any }) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  if (!data) return <p className="text-sm text-text-muted p-4">Failed to load security data.</p>;

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Risk Events" value={data.totalEvents} icon={ShieldCheck} color="text-navy-600" bg="bg-navy-900/5 border-navy-900/10" />
        <StatCard label="High Risk" value={data.highRisk} icon={AlertTriangle} color="text-red-600" bg="bg-red-500/5 border-red-500/15" />
        <StatCard label="Medium Risk" value={data.mediumRisk} icon={Info} color="text-amber-600" bg="bg-amber-500/5 border-amber-500/15" />
        <StatCard label="Avg Risk Score" value={`${data.avgScore}/100`} icon={BarChart2} color="text-blue-600" bg="bg-blue-500/5 border-blue-500/15" />
      </div>

      {/* Device Trust */}
      <div>
        <SectionHeader title="Trusted Devices" sub="Devices used to access your account" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-2xs">
          {data.devices.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs font-bold">No devices registered.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.devices.map((d: any) => (
                <div key={d.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-surface-alt/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center border',
                      d.is_trusted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                    )}>
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-navy-900">{d.device_label || 'Unknown Device'}</p>
                      <p className="text-[10px] text-text-muted font-medium mt-0.5">First seen: {formatDate(d.first_seen)} · Last used: {formatDate(d.last_used)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-2xs',
                    d.is_trusted ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' : 'bg-amber-500/10 text-amber-700 border-amber-200'
                  )}>
                    {d.is_trusted ? 'Trusted' : 'Unverified'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <SectionHeader title="Recent Sessions" sub="Last 10 login sessions" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-2xs">
          {data.sessions.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs font-bold">No session history found.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.sessions.map((s: any) => (
                <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-surface-alt/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center border',
                      s.is_valid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
                    )}>
                      {s.is_valid ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-navy-900">{s.ip_address || 'Unknown IP'}</p>
                      <p className="text-[10px] text-text-muted truncate max-w-xs font-medium mt-0.5">{s.user_agent ? s.user_agent.slice(0, 60) + '...' : 'Unknown agent'}</p>
                      <p className="text-[9px] text-text-muted mt-1 font-bold">Started: {new Date(s.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 shadow-2xs',
                    s.is_valid ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-300'
                  )}>
                    {s.is_valid ? 'Active' : 'Expired'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Risk Event Log */}
      <div>
        <SectionHeader title="Risk Event Log" sub="Last 50 attendance security events" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-2xs">
          {data.riskEvents.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs font-bold">No risk events recorded.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.riskEvents.map((e: any) => {
                const isExpanded = expandedEvent === e.id;
                return (
                  <div key={e.id} className="group/row">
                    <button
                      onClick={() => setExpandedEvent(isExpanded ? null : e.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-alt/40 transition-colors text-left"
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 transition-colors group-hover/row:border-current/40',
                        e.risk_level === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                        e.risk_level === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                      )}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-navy-900 capitalize">{e.action.replace('_', ' ')}</span>
                          <RiskBadge level={e.risk_level} />
                          <span className="text-[9px] font-mono text-text-muted font-bold">{e.risk_score} pts</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-muted font-medium">
                          <span>{e.ip_address || 'Unknown IP'}</span>
                          <span>{e.is_office_network ? '🏢 Office' : '🌐 External'}</span>
                          <span>{e.is_known_device ? '✓ Known Device' : '⚠ New Device'}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right flex items-center gap-2">
                        <div>
                          <p className="text-[9px] text-text-muted font-bold">{new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && e.risk_reasons?.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-1.5 bg-surface-alt/25 border-t border-border/30 space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2 leading-none">Signal Breakdown</p>
                            {e.risk_reasons.map((sig: any, i: number) => (
                              <div key={i} className={cn(
                                "flex items-center justify-between text-[10px] bg-white rounded-lg px-3.5 py-2.5 border border-border/40 border-l-2 shadow-2xs",
                                sig.weight > 0 ? "border-l-red-500" : "border-l-emerald-500"
                              )}>
                                <span className="font-semibold text-navy-900">{sig.detail}</span>
                                <span className={cn('font-black', sig.weight > 0 ? 'text-red-500' : 'text-emerald-550')}>
                                  {sig.weight > 0 ? `+${sig.weight} pts` : '✓ Safe'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ReportsClient({ attendance, leaves, dailyReports, security }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('attendance');

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leaves', label: 'Leaves', icon: Calendar },
    { id: 'daily', label: 'Daily Reports', icon: ClipboardList },
    { id: 'security', label: 'Security', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      {/* Tab Bar */}
      <div className="flex gap-1 bg-surface-alt/70 backdrop-blur-md rounded-xl p-1.5 border border-border/50 overflow-x-auto relative">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap flex-1 justify-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 z-10',
                isActive
                  ? 'text-navy-900 font-black'
                  : 'text-text-muted hover:text-navy-900'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white rounded-lg border border-border/40 shadow-xs z-[-1]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Overview Strip */}
      {activeTab === 'attendance' && attendance && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 border border-primary-500/20 shadow-md text-white text-xs font-semibold overflow-x-auto relative overflow-hidden bg-noise">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-transparent to-primary-500/10 opacity-30" />
          <Sparkles className="w-4 h-4 text-primary-300 animate-pulse shrink-0 relative z-10" />
          <span className="text-primary-400 font-black uppercase tracking-wider text-[9px] shrink-0 relative z-10">This Month</span>
          <div className="h-4 w-px bg-white/10 relative z-10" />
          <span className="shrink-0 relative z-10 font-bold">{attendance.present} present</span>
          <span className="text-white/30 relative z-10">·</span>
          <span className="shrink-0 text-amber-300 font-bold relative z-10">{attendance.late} late</span>
          <span className="text-white/30 relative z-10">·</span>
          <span className="shrink-0 relative z-10 font-bold">{attendance.totalProductiveHours}h productive</span>
          <span className="text-white/30 relative z-10">·</span>
          <span className="shrink-0 flex items-center gap-1 relative z-10"><Coffee className="w-3 h-3 text-primary-300" />{formatSeconds(attendance.totalBreakSeconds)} break</span>
          {attendance.deductionTotal > 0 && (
            <>
              <span className="text-white/30 relative z-10">·</span>
              <span className="shrink-0 text-red-300 font-bold relative z-10">{attendance.deductionTotal}d deducted</span>
            </>
          )}
        </div>
      )}

      {activeTab === 'security' && security && (
        <div className={cn(
          'flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-semibold overflow-x-auto border shadow-xs relative overflow-hidden',
          security.highRisk > 0 
            ? 'bg-red-50/70 backdrop-blur-sm border-red-200 text-red-800' 
            : 'bg-emerald-50/70 backdrop-blur-sm border-emerald-200 text-emerald-800'
        )}>
          <ShieldCheck className={cn("w-4 h-4 shrink-0", security.highRisk > 0 ? "text-red-500" : "text-emerald-550")} />
          <span className="font-black uppercase tracking-wider text-[9px] shrink-0">Security Status</span>
          <div className="h-4 w-px bg-current opacity-20" />
          <span className="shrink-0 font-bold">{security.totalEvents} events</span>
          <span className="opacity-30">·</span>
          <span className="shrink-0 text-red-600 font-extrabold">{security.highRisk} high risk</span>
          <span className="opacity-30">·</span>
          <span className="shrink-0">{security.trustedDevices} trusted device{security.trustedDevices !== 1 ? 's' : ''}</span>
          <span className="opacity-30">·</span>
          <span className="shrink-0 font-bold">Avg score: {security.avgScore}/100</span>
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'attendance' && <AttendanceReport data={attendance} />}
          {activeTab === 'leaves' && <LeavesReport data={leaves} />}
          {activeTab === 'daily' && <DailyReportsReport data={dailyReports} />}
          {activeTab === 'security' && <SecurityReport data={security} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
