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
    <div className={cn('rounded-xl p-4 border flex flex-col gap-3', bg)}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color, 'bg-white/60')}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-2xl font-black text-navy-900 leading-none">{value}</p>
        {sub && <p className="text-[10px] text-text-muted font-semibold mt-0.5">{sub}</p>}
        <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-1">{label}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-primary-500 rounded-full" />
      <div>
        <h3 className="font-bold text-navy-900 text-base tracking-tight">{title}</h3>
        {sub && <p className="text-[10px] text-text-muted font-medium">{sub}</p>}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={cn(
      'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
      level === 'high' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
      level === 'medium' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    )}>
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  return (
    <span className={cn(
      'inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border',
      s === 'approved' || s === 'logged out' || s === 'approved wfh' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
      s === 'pending' || s === 'pending wfh' || s === 'working' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
      s === 'rejected' || s === 'rejected wfh' || s === 'absent' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
      s === 'on break' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
      'bg-gray-500/10 text-gray-600 border-gray-500/20'
    )}>
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
        <div className="rounded-xl border border-border/60 bg-white p-4 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Total Productive Hours</p>
          <p className="text-3xl font-black text-navy-900">{data.totalProductiveHours}<span className="text-sm font-semibold text-text-muted ml-1">hrs</span></p>
          <p className="text-[10px] text-text-muted">Avg {data.avgProductiveHours} hrs/day</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-4 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Total Break Time</p>
          <p className="text-3xl font-black text-navy-900">{formatSeconds(data.totalBreakSeconds)}</p>
          <p className="text-[10px] text-text-muted">Across {data.present} working days</p>
        </div>
        <div className={cn(
          'rounded-xl border p-4 space-y-1',
          data.deductionTotal > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white border-border/60'
        )}>
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Attendance Deductions</p>
          <p className={cn('text-3xl font-black', data.deductionTotal > 0 ? 'text-red-600' : 'text-navy-900')}>
            {data.deductionTotal}<span className="text-sm font-semibold text-text-muted ml-1">days</span>
          </p>
          <p className="text-[10px] text-text-muted">{data.late} late login{data.late !== 1 ? 's' : ''} this month</p>
        </div>
      </div>

      {/* Daily Log Table */}
      <div>
        <SectionHeader title="Daily Attendance Log" sub="This month's full record" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
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
                  <div key={r.id}>
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-alt border border-border/40 flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-black text-navy-900 leading-none">{new Date(r.date).getDate()}</span>
                        <span className="text-[8px] font-bold text-text-muted uppercase">{new Date(r.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-navy-900">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
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
                      <div className="shrink-0 text-gray-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 bg-surface-alt/30 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><p className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-0.5">Break Time</p><p className="font-semibold text-navy-900">{formatSeconds(r.total_break_seconds)}</p></div>
                            <div><p className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-0.5">Productive</p><p className="font-semibold text-navy-900">{r.productive_hours}h</p></div>
                            <div><p className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-0.5">Deduction</p><p className={cn('font-semibold', r.deduction_applied > 0 ? 'text-red-600' : 'text-navy-900')}>{r.deduction_applied > 0 ? `${r.deduction_applied} day` : 'None'}</p></div>
                            <div><p className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-0.5">Exemption</p><p className="font-semibold text-navy-900">{isExempted ? 'Yes' : 'No'}</p></div>
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
      <div className="rounded-xl border border-border/60 bg-white p-5">
        <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-3">Casual Leave Balance — This Month</p>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-4xl font-black text-navy-900">{data.remainingCasual}<span className="text-base font-semibold text-text-muted ml-1">/ 1 day</span></p>
            <p className="text-[10px] text-text-muted mt-1">{data.usedCasual} used this month</p>
          </div>
          <div className="flex-1 h-3 rounded-full bg-surface-alt overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', data.usedCasual >= 1 ? 'bg-red-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(100, (data.usedCasual / 1) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Leave History */}
      <div>
        <SectionHeader title="Leave Request History" sub="All time" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          {data.leaves.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-xs font-bold">No leave requests found.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.leaves.map((l: any) => (
                <div key={l.id} className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-surface-alt/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-navy-900">{l.type} Leave</span>
                      <StatusBadge status={l.status || 'Pending'} />
                    </div>
                    <p className="text-[10px] text-text-muted font-medium">
                      {formatDate(l.start_date)} — {formatDate(l.end_date)}
                    </p>
                    {l.reason && (
                      <p className="text-[10px] text-text-secondary italic bg-surface-alt/60 px-2 py-1 rounded border border-border/30 max-w-sm">
                        &ldquo;{l.reason}&rdquo;
                      </p>
                    )}
                  </div>
                  <p className="text-[9px] text-text-muted font-medium shrink-0 text-right">
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
          <div key={s.label} className="rounded-xl border border-border/60 bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">{s.label}</p>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Daily Log */}
      <div>
        <SectionHeader title="Daily Report Log" sub="This month's submissions" />
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          {data.records.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-xs font-bold">No reports submitted this month.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.records.map((r: any) => {
                const isExpanded = expandedRow === r.id;
                const total = r.applications_count + r.interviews_count + r.assessments + r.technical_rounds + r.non_technical + r.self_submissions + r.support_submissions;
                return (
                  <div key={r.id}>
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-alt border border-border/40 flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-black text-navy-900 leading-none">{new Date(r.report_date).getDate()}</span>
                        <span className="text-[8px] font-bold text-text-muted uppercase">{new Date(r.report_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-navy-900">{r.client_name}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{total} total activities · {r.applications_count} apps · {r.interviews_count} interviews</p>
                      </div>
                      <div className="shrink-0 text-gray-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 bg-surface-alt/30 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {[
                              { label: 'Applications', value: r.applications_count },
                              { label: 'Interviews', value: r.interviews_count },
                              { label: 'Assessments', value: r.assessments },
                              { label: 'Technical', value: r.technical_rounds },
                              { label: 'Non-Technical', value: r.non_technical },
                              { label: 'Self Submissions', value: r.self_submissions },
                              { label: 'Support Submissions', value: r.support_submissions },
                            ].map(f => (
                              <div key={f.label}>
                                <p className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-0.5">{f.label}</p>
                                <p className="font-semibold text-navy-900">{f.value}</p>
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
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          {data.devices.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs font-bold">No devices registered.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.devices.map((d: any) => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-surface-alt/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center border',
                      d.is_trusted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                    )}>
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-900">{d.device_label || 'Unknown Device'}</p>
                      <p className="text-[10px] text-text-muted">First seen: {formatDate(d.first_seen)} · Last used: {formatDate(d.last_used)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border',
                    d.is_trusted ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
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
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          {data.sessions.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs font-bold">No session history found.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.sessions.map((s: any) => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-surface-alt/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center border',
                      s.is_valid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
                    )}>
                      {s.is_valid ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-900">{s.ip_address || 'Unknown IP'}</p>
                      <p className="text-[10px] text-text-muted truncate max-w-xs">{s.user_agent ? s.user_agent.slice(0, 60) + '...' : 'Unknown agent'}</p>
                      <p className="text-[9px] text-text-muted mt-0.5">Started: {new Date(s.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0',
                    s.is_valid ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
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
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          {data.riskEvents.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs font-bold">No risk events recorded.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.riskEvents.map((e: any) => {
                const isExpanded = expandedEvent === e.id;
                return (
                  <div key={e.id}>
                    <button
                      onClick={() => setExpandedEvent(isExpanded ? null : e.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/40 transition-colors text-left"
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center border shrink-0',
                        e.risk_level === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                        e.risk_level === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                      )}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-navy-900 capitalize">{e.action.replace('_', ' ')}</span>
                          <RiskBadge level={e.risk_level} />
                          <span className="text-[9px] font-mono text-text-muted">{e.risk_score} pts</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-muted">
                          <span>{e.ip_address || 'Unknown IP'}</span>
                          <span>{e.is_office_network ? '🏢 Office Network' : '🌐 External'}</span>
                          <span>{e.is_known_device ? '✓ Known Device' : '⚠ New Device'}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] text-text-muted">{new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                        <div className="text-gray-400 mt-1">{isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}</div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && e.risk_reasons?.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pt-1 bg-surface-alt/30 space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2">Signal Breakdown</p>
                            {e.risk_reasons.map((sig: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-[10px] bg-white rounded-lg px-3 py-2 border border-border/40">
                                <span className="font-medium text-navy-900">{sig.detail}</span>
                                <span className={cn('font-black', sig.weight > 0 ? 'text-red-500' : 'text-emerald-500')}>
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
      <div className="flex gap-1 bg-surface-alt rounded-xl p-1 border border-border/50 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-1 justify-center',
                isActive
                  ? 'bg-white text-navy-900 shadow-sm border border-border/40'
                  : 'text-text-muted hover:text-navy-900'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Overview Strip */}
      {activeTab === 'attendance' && attendance && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-900 text-white text-xs font-semibold overflow-x-auto">
          <Sparkles className="w-4 h-4 text-primary-400 shrink-0" />
          <span className="text-primary-200 font-black uppercase tracking-wider text-[9px] shrink-0">This Month</span>
          <div className="h-4 w-px bg-white/10" />
          <span className="shrink-0">{attendance.present} present</span>
          <span className="text-white/30">·</span>
          <span className="shrink-0 text-amber-300">{attendance.late} late</span>
          <span className="text-white/30">·</span>
          <span className="shrink-0">{attendance.totalProductiveHours}h productive</span>
          <span className="text-white/30">·</span>
          <span className="shrink-0 flex items-center gap-1"><Coffee className="w-3 h-3" />{formatSeconds(attendance.totalBreakSeconds)} break</span>
          {attendance.deductionTotal > 0 && (
            <>
              <span className="text-white/30">·</span>
              <span className="shrink-0 text-red-300">{attendance.deductionTotal}d deducted</span>
            </>
          )}
        </div>
      )}

      {activeTab === 'security' && security && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold overflow-x-auto',
          security.highRisk > 0 ? 'bg-red-500/10 border border-red-500/20 text-red-800' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800'
        )}>
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="font-black uppercase tracking-wider text-[9px] shrink-0">Security Status</span>
          <div className="h-4 w-px bg-current opacity-20" />
          <span className="shrink-0">{security.totalEvents} events</span>
          <span className="opacity-30">·</span>
          <span className="shrink-0">{security.highRisk} high risk</span>
          <span className="opacity-30">·</span>
          <span className="shrink-0">{security.trustedDevices} trusted device{security.trustedDevices !== 1 ? 's' : ''}</span>
          <span className="opacity-30">·</span>
          <span className="shrink-0">Avg score: {security.avgScore}/100</span>
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
