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
import StatusBadge from '@/components/ui/StatusBadge';

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
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string;
}) {
  return (
    <div className="bg-white rounded-lg p-5 border border-zinc-200/80 flex flex-col gap-4 relative hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-md bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-550">
          <Icon className="w-4 h-4" />
        </div>
        {sub && (
          <span className="text-[9px] font-mono font-medium text-primary-700 bg-primary-50/50 border border-primary-200/40 px-1.5 py-0.5 rounded">
            {sub}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-navy-900 font-sans leading-none">{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mt-2 font-sans">{label}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 mb-5">
      <h3 className="font-semibold text-navy-900 text-sm tracking-tight font-sans">{title}</h3>
      {sub && <p className="text-[11px] text-zinc-400 font-medium tracking-normal">{sub}</p>}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium border uppercase tracking-wider',
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

// StatusBadge inline function removed in favor of shared component import

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceReport({ data }: { data: any }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!data) return <p className="text-sm text-zinc-400 p-4 font-sans">Failed to load attendance data.</p>;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label="Days Present" 
          value={data.present} 
          icon={CheckCircle2} 
          color="text-emerald-600" 
        />
        <StatCard 
          label="Late Entries" 
          value={data.late} 
          sub="Unexempted" 
          icon={AlertTriangle} 
          color="text-amber-600" 
        />
        <StatCard 
          label="Absences" 
          value={data.absent} 
          icon={XCircle} 
          color="text-red-600" 
        />
        <StatCard 
          label="WFH Days" 
          value={data.wfh} 
          sub={data.pendingWfh > 0 ? `${data.pendingWfh} pending` : undefined} 
          icon={MapPin} 
          color="text-primary-600" 
        />
      </div>

      {/* Hours Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-3 hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-none font-sans">Total Productive Hours</p>
          <p className="text-2xl font-bold text-navy-900 leading-none font-sans tracking-tight">
            {data.totalProductiveHours}
            <span className="text-xs font-semibold text-zinc-400 ml-1">hrs</span>
          </p>
          <p className="text-[11px] text-zinc-400 font-medium font-sans">Avg {data.avgProductiveHours} hrs/day</p>
        </div>
        
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-3 hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-none font-sans">Total Break Time</p>
          <p className="text-2xl font-bold text-navy-900 leading-none font-sans tracking-tight">
            {formatSeconds(data.totalBreakSeconds)}
          </p>
          <p className="text-[11px] text-zinc-400 font-medium font-sans">Across {data.present} working days</p>
        </div>
        
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-3 hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-none font-sans">Attendance Deductions</p>
          <p className={cn('text-2xl font-bold leading-none font-sans tracking-tight', data.deductionTotal > 0 ? 'text-red-600' : 'text-navy-900')}>
            {data.deductionTotal}
            <span className="text-xs font-semibold text-zinc-400 ml-1">days</span>
          </p>
          <p className="text-[11px] text-zinc-400 font-medium font-sans">{data.late} late login{data.late !== 1 ? 's' : ''} this month</p>
        </div>
      </div>

      {/* Daily Log Table */}
      <div>
        <SectionHeader title="Daily Attendance Log" sub="This month's full record" />
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          {data.records.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 text-xs font-medium font-sans">No records this month.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.records.map((r: any) => {
                const isExpanded = expandedRow === r.id;
                const checkIn = r.check_in ? new Date(r.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
                const checkOut = r.check_out ? new Date(r.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
                const isExempted = r.late_approved || r.permission_approved || r.shift_override || r.manager_exemption;
                return (
                  <div key={r.id} className="group/row">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-zinc-50/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded bg-zinc-50 border border-zinc-200 flex flex-col items-center justify-center shrink-0 group-hover/row:border-primary-500/30 transition-colors">
                        <span className="text-sm font-bold text-navy-900 leading-none font-sans">{new Date(r.date).getDate()}</span>
                        <span className="text-[8px] font-semibold text-zinc-400 uppercase mt-0.5 font-sans">{new Date(r.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-navy-900">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                          <StatusBadge status={r.status} />
                          {r.is_late && !isExempted && <span className="text-[8px] font-mono font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Late {r.late_minutes}m</span>}
                          {r.is_late && isExempted && <span className="text-[8px] font-mono font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Exempted</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400 font-mono">
                          <span className="flex items-center gap-1"><LogIn className="w-3 h-3 text-emerald-500" />{checkIn}</span>
                          <span className="flex items-center gap-1"><LogOut className="w-3 h-3 text-red-400" />{checkOut}</span>
                          {r.productive_hours > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-zinc-500" />{r.productive_hours}h productive</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-zinc-400 transition-transform duration-200">
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden bg-zinc-50/20"
                        >
                          <div className="px-5 pb-5 pt-1 bg-zinc-50/40 border-t border-zinc-150 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div className="bg-white p-3 rounded border border-zinc-200">
                              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5 font-sans">Break Time</p>
                              <p className="font-semibold text-navy-900 text-sm mt-1 font-mono">{formatSeconds(r.total_break_seconds)}</p>
                            </div>
                            <div className="bg-white p-3 rounded border border-zinc-200">
                              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5 font-sans">Productive</p>
                              <p className="font-semibold text-navy-900 text-sm mt-1 font-mono">{r.productive_hours}h</p>
                            </div>
                            <div className="bg-white p-3 rounded border border-zinc-200">
                              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5 font-sans">Deduction</p>
                              <p className={cn('font-semibold text-sm mt-1 font-mono', r.deduction_applied > 0 ? 'text-red-600' : 'text-navy-900')}>{r.deduction_applied > 0 ? `${r.deduction_applied} day` : 'None'}</p>
                            </div>
                            <div className="bg-white p-3 rounded border border-zinc-200">
                              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5 font-sans">Exemption</p>
                              <p className="font-semibold text-navy-900 text-sm mt-1 font-sans">{isExempted ? 'Yes' : 'No'}</p>
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
  if (!data) return <p className="text-sm text-zinc-400 p-4 font-sans">Failed to load leave data.</p>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label="Total Requests" 
          value={data.total} 
          icon={Calendar} 
          color="text-primary-600" 
        />
        <StatCard 
          label="Approved" 
          value={data.approved} 
          icon={CheckCircle2} 
          color="text-emerald-600" 
        />
        <StatCard 
          label="Pending" 
          value={data.pending} 
          icon={AlertTriangle} 
          color="text-amber-600" 
        />
        <StatCard 
          label="Rejected" 
          value={data.rejected} 
          icon={XCircle} 
          color="text-red-600" 
        />
      </div>

      {/* Casual Leave Balance */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-3 font-sans">Casual Leave Balance — This Month</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            <p className="text-2xl font-bold text-navy-900 font-sans tracking-tight">
              {data.remainingCasual}
              <span className="text-xs font-semibold text-zinc-400 ml-1 font-sans">/ 1 day</span>
            </p>
            <p className="text-[10px] text-zinc-400 font-medium mt-1 font-sans">{data.usedCasual} used this month</p>
          </div>
          <div className="flex-1 h-2 rounded bg-zinc-100 overflow-hidden border border-zinc-150">
            <div
              className={cn('h-full rounded transition-all', data.usedCasual >= 1 ? 'bg-red-500' : 'bg-primary-500')}
              style={{ width: `${Math.min(100, (data.usedCasual / 1) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Leave History */}
      <div>
        <SectionHeader title="Leave Request History" sub="All time" />
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          {data.leaves.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 text-xs font-semibold font-sans">No leave requests found.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.leaves.map((l: any) => (
                <div key={l.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-zinc-50/40 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-navy-900">{l.type} Leave</span>
                      <StatusBadge status={l.status || 'Pending'} />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono font-medium tracking-wide uppercase">
                      {formatDate(l.start_date)} — {formatDate(l.end_date)}
                    </p>
                    {l.reason && (
                      <p className="text-[10px] text-zinc-500 italic bg-zinc-50 px-3 py-1.5 rounded border border-zinc-200 max-w-sm mt-1.5 leading-relaxed">
                        &ldquo;{l.reason}&rdquo;
                      </p>
                    )}
                  </div>
                  <p className="text-[9px] text-zinc-400 font-mono font-semibold shrink-0 text-right">
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

  if (!data) return <p className="text-sm text-zinc-400 p-4 font-sans">Failed to load daily report data.</p>;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label="Days Reported" 
          value={data.daysReported} 
          icon={ClipboardList} 
          color="text-primary-600" 
        />
        <StatCard 
          label="Total Applications" 
          value={data.totalApplications} 
          icon={FileText} 
          color="text-primary-600" 
        />
        <StatCard 
          label="Interviews Scheduled" 
          value={data.totalInterviews} 
          icon={User} 
          color="text-violet-600" 
        />
        <StatCard 
          label="Assessments" 
          value={data.totalAssessments} 
          icon={Activity} 
          color="text-emerald-600" 
        />
      </div>

      {/* Submission Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Technical Rounds', value: data.totalTechnical, color: 'text-cyan-600' },
          { label: 'Non-Technical', value: data.totalNonTechnical, color: 'text-indigo-600' },
          { label: 'Self Submissions', value: data.totalSelfSub, color: 'text-teal-600' },
          { label: 'Support Submissions', value: data.totalSupportSub, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 border border-zinc-200 hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-none font-sans">{s.label}</p>
            <p className={cn('text-2xl font-bold leading-none mt-2 font-sans', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Daily Log */}
      <div>
        <SectionHeader title="Daily Report Log" sub="This month's submissions" />
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          {data.records.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 text-xs font-semibold font-sans">No reports submitted this month.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.records.map((r: any) => {
                const isExpanded = expandedRow === r.id;
                const total = r.applications_count + r.interviews_count + r.assessments + r.technical_rounds + r.non_technical + r.self_submissions + r.support_submissions;
                return (
                  <div key={r.id} className="group/row">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-50/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded bg-zinc-50 border border-zinc-200 flex flex-col items-center justify-center shrink-0 group-hover/row:border-primary-500/30 transition-colors">
                        <span className="text-sm font-bold text-navy-900 leading-none font-sans">{new Date(r.report_date).getDate()}</span>
                        <span className="text-[8px] font-semibold text-zinc-400 uppercase mt-0.5 font-sans">{new Date(r.report_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-navy-900">{r.client_name}</p>
                        <p className="text-[10px] text-zinc-400 font-medium mt-0.5 font-sans">{total} total activities · {r.applications_count} apps · {r.interviews_count} interviews</p>
                      </div>
                      <div className="shrink-0 text-zinc-400">
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden bg-zinc-50/20"
                        >
                          <div className="px-5 pb-5 pt-1 bg-zinc-50/40 border-t border-zinc-150 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            {[
                              { label: 'Applications', value: r.applications_count },
                              { label: 'Interviews', value: r.interviews_count },
                              { label: 'Assessments', value: r.assessments },
                              { label: 'Technical', value: r.technical_rounds },
                              { label: 'Non-Technical', value: r.non_technical },
                              { label: 'Self Submissions', value: r.self_submissions },
                              { label: 'Support Submissions', value: r.support_submissions },
                            ].map(f => (
                              <div key={f.label} className="bg-white p-3 rounded border border-zinc-200 shadow-3xs">
                                <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5 font-sans">{f.label}</p>
                                <p className="font-semibold text-navy-900 text-sm mt-1 font-mono">{f.value}</p>
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

  if (!data) return <p className="text-sm text-zinc-400 p-4 font-sans">Failed to load security data.</p>;

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label="Total Risk Events" 
          value={data.totalEvents} 
          icon={ShieldCheck} 
          color="text-navy-900" 
        />
        <StatCard 
          label="High Risk" 
          value={data.highRisk} 
          icon={AlertTriangle} 
          color="text-red-600" 
        />
        <StatCard 
          label="Medium Risk" 
          value={data.mediumRisk} 
          icon={Info} 
          color="text-amber-600" 
        />
        <StatCard 
          label="Avg Risk Score" 
          value={`${data.avgScore}/100`} 
          icon={BarChart2} 
          color="text-primary-600" 
        />
      </div>

      {/* Device Trust */}
      <div>
        <SectionHeader title="Trusted Devices" sub="Devices used to access your account" />
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          {data.devices.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-semibold font-sans">No devices registered.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.devices.map((d: any) => (
                <div key={d.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-50/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded flex items-center justify-center border',
                      d.is_trusted ? 'bg-emerald-50 border-emerald-150 text-emerald-600' : 'bg-amber-50 border-amber-150 text-amber-600'
                    )}>
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-900">{d.device_label || 'Unknown Device'}</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">First seen: {formatDate(d.first_seen)} · Last used: {formatDate(d.last_used)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[9px] font-mono font-medium px-2 py-0.5 rounded border shadow-3xs uppercase tracking-wider',
                    d.is_trusted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
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
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          {data.sessions.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-semibold font-sans">No session history found.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.sessions.map((s: any) => (
                <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-50/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded flex items-center justify-center border',
                      s.is_valid ? 'bg-emerald-50 border-emerald-150 text-emerald-600' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                    )}>
                      {s.is_valid ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-900">{s.ip_address || 'Unknown IP'}</p>
                      <p className="text-[10px] text-zinc-400 truncate max-w-xs font-mono mt-0.5">{s.user_agent ? s.user_agent.slice(0, 60) + '...' : 'Unknown agent'}</p>
                      <p className="text-[9px] text-zinc-450 font-mono mt-1 font-semibold">Started: {new Date(s.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[9px] font-mono font-medium px-2 py-0.5 rounded border shrink-0 shadow-3xs uppercase tracking-wider',
                    s.is_valid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-650 border-zinc-200'
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
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          {data.riskEvents.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-semibold font-sans">No risk events recorded.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.riskEvents.map((e: any) => {
                const isExpanded = expandedEvent === e.id;
                return (
                  <div key={e.id} className="group/row">
                    <button
                      onClick={() => setExpandedEvent(isExpanded ? null : e.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50/50 transition-colors text-left"
                    >
                      <div className={cn(
                        'w-9 h-9 rounded flex items-center justify-center border shrink-0 transition-colors group-hover/row:border-zinc-350',
                        e.risk_level === 'high' ? 'bg-red-50 border-red-150 text-red-600' :
                        e.risk_level === 'medium' ? 'bg-amber-50 border-amber-150 text-amber-600' :
                        'bg-emerald-50 border-emerald-150 text-emerald-600'
                      )}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-navy-900 capitalize">{e.action.replace('_', ' ')}</span>
                          <RiskBadge level={e.risk_level} />
                          <span className="text-[9px] font-mono text-zinc-500 font-semibold">{e.risk_score} pts</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-400 font-mono">
                          <span>{e.ip_address || 'Unknown IP'}</span>
                          <span>{e.is_office_network ? '🏢 Office' : '🌐 External'}</span>
                          <span>{e.is_known_device ? '✓ Known Device' : '⚠ New Device'}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right flex items-center gap-2">
                        <div>
                          <p className="text-[9px] text-zinc-500 font-mono font-semibold">{new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && e.risk_reasons?.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-1 bg-zinc-50/40 border-t border-zinc-100 space-y-1.5">
                            <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-2 leading-none font-sans">Signal Breakdown</p>
                            {e.risk_reasons.map((sig: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-[10px] bg-white rounded p-2.5 border border-zinc-200 shadow-sm">
                                <span className="font-semibold text-navy-900 font-sans">{sig.detail}</span>
                                <span className={cn('font-bold font-mono', sig.weight > 0 ? 'text-red-500' : 'text-emerald-600')}>
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
      {/* Tab Bar - Vercel layout + Primetek Navy Color */}
      <div className="flex border-b border-zinc-200 overflow-x-auto scrollbar-none relative">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-150 whitespace-nowrap relative border-b-2 focus-visible:outline-none',
                isActive
                  ? 'border-navy-900 text-navy-900 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Overview Strip - Vercel layout + Primetek Teal Color */}
      {activeTab === 'attendance' && attendance && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 bg-white shadow-sm text-zinc-600 text-xs font-medium overflow-x-auto scrollbar-none">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-mono font-medium text-primary-600 uppercase tracking-wider shrink-0">Summary</span>
          <div className="h-3 w-px bg-zinc-200" />
          <span className="shrink-0 font-semibold text-navy-900">{attendance.present} present</span>
          <span className="text-zinc-300">·</span>
          <span className="shrink-0 text-amber-600 font-semibold">{attendance.late} late</span>
          <span className="text-zinc-300">·</span>
          <span className="shrink-0 font-semibold text-navy-900">{attendance.totalProductiveHours}h productive</span>
          <span className="text-zinc-300">·</span>
          <span className="shrink-0 flex items-center gap-1"><Coffee className="w-3.5 h-3.5 text-zinc-500" />{formatSeconds(attendance.totalBreakSeconds)} break</span>
          {attendance.deductionTotal > 0 && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="shrink-0 text-red-600 font-bold">{attendance.deductionTotal}d deducted</span>
            </>
          )}
        </div>
      )}

      {activeTab === 'security' && security && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 bg-white shadow-sm text-zinc-600 text-xs font-medium overflow-x-auto scrollbar-none">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 animate-pulse", security.highRisk > 0 ? "bg-red-500" : "bg-primary-500")} />
          <span className="text-[10px] font-mono font-medium text-primary-600 uppercase tracking-wider shrink-0">Security Status</span>
          <div className="h-3 w-px bg-zinc-200" />
          <span className="shrink-0 font-semibold text-navy-900">{security.totalEvents} events</span>
          <span className="text-zinc-300">·</span>
          <span className="shrink-0 text-red-600 font-bold">{security.highRisk} high risk</span>
          <span className="text-zinc-300">·</span>
          <span className="shrink-0">{security.trustedDevices} trusted device{security.trustedDevices !== 1 ? 's' : ''}</span>
          <span className="text-zinc-300">·</span>
          <span className="shrink-0 font-bold text-navy-900">Avg score: {security.avgScore}/100</span>
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.1 }}
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
