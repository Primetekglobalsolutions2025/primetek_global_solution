'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

// ─── Attendance Summary ───────────────────────────────────────────────────────

export async function getAttendanceSummary() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endOfMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data: records, error } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('employee_id', session.id)
    .gte('date', startOfMonth)
    .lt('date', endOfMonth)
    .order('date', { ascending: true });

  if (error) throw error;

  const all = records || [];

  const present = all.filter(r =>
    ['Working', 'Logged Out', 'On Break', 'Break', 'Break (Auto)', 'Approved WFH'].includes(r.status)
  ).length;

  const late = all.filter(r =>
    r.is_late &&
    !r.late_approved &&
    !r.permission_approved &&
    !r.shift_override &&
    !r.manager_exemption &&
    r.status !== 'Approved WFH'
  ).length;

  const absent = all.filter(r => r.status === 'Absent').length;
  const wfh = all.filter(r => r.status === 'Approved WFH').length;
  const pendingWfh = all.filter(r => r.status === 'Pending WFH').length;

  const totalProductiveHours = all.reduce((sum, r) => sum + (r.productive_hours || 0), 0);
  const totalBreakSeconds = all.reduce((sum, r) => sum + (r.total_break_seconds || 0), 0);
  const totalDurationHours = all.reduce((sum, r) => {
    if (r.check_in && r.check_out) {
      const diff = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
      return sum + diff;
    }
    return sum;
  }, 0);

  const avgProductiveHours = present > 0 ? totalProductiveHours / present : 0;

  // Deductions
  const deductionTotal = all.reduce((sum, r) => sum + (r.deduction_applied || 0), 0);

  return {
    present,
    late,
    absent,
    wfh,
    pendingWfh,
    totalProductiveHours: Math.round(totalProductiveHours * 10) / 10,
    totalBreakSeconds,
    totalDurationHours: Math.round(totalDurationHours * 10) / 10,
    avgProductiveHours: Math.round(avgProductiveHours * 10) / 10,
    deductionTotal,
    records: all.map(r => ({
      id: r.id,
      date: r.date,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status,
      is_late: r.is_late || false,
      late_minutes: r.late_minutes || 0,
      productive_hours: r.productive_hours || 0,
      total_break_seconds: r.total_break_seconds || 0,
      deduction_applied: r.deduction_applied || 0,
      late_approved: r.late_approved || false,
      permission_approved: r.permission_approved || false,
      shift_override: r.shift_override || false,
      manager_exemption: r.manager_exemption || false,
    })),
  };
}

// ─── Leave Summary ────────────────────────────────────────────────────────────

export async function getLeaveSummary() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: leaves, error: lError } = await supabaseAdmin
    .from('leave_requests')
    .select('*')
    .eq('employee_id', session.id)
    .order('created_at', { ascending: false });

  if (lError) throw lError;

  const { data: balances, error: bError } = await supabaseAdmin
    .from('leave_balances')
    .select('*')
    .eq('employee_id', session.id)
    .eq('year', year)
    .eq('month', month);

  if (bError) throw bError;

  const all = leaves || [];
  const approved = all.filter(l => l.status === 'Approved').length;
  const pending = all.filter(l => l.status === 'Pending').length;
  const rejected = all.filter(l => l.status === 'Rejected').length;

  const casualBalance = (balances || []).find(b => b.leave_type === 'Casual');
  const remainingCasual = casualBalance ? casualBalance.remaining_days : 1;
  const usedCasual = casualBalance ? casualBalance.used_days : 0;

  return {
    total: all.length,
    approved,
    pending,
    rejected,
    remainingCasual,
    usedCasual,
    leaves: all.map(l => ({
      id: l.id,
      type: l.type,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason,
      status: l.status,
      created_at: l.created_at,
    })),
  };
}

// ─── Daily Report Summary ─────────────────────────────────────────────────────

export async function getDailyReportSummary() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endOfMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data: metrics, error } = await supabaseAdmin
    .from('profile_daily_metrics')
    .select(`
      *,
      application_profiles ( client_name )
    `)
    .eq('employee_id', session.id)
    .gte('report_date', startOfMonth)
    .lt('report_date', endOfMonth)
    .order('report_date', { ascending: false });

  if (error) throw error;

  const all = metrics || [];

  const totalApplications = all.reduce((s, r) => s + (r.applications_count || 0), 0);
  const totalInterviews = all.reduce((s, r) => s + (r.interviews_count || 0), 0);
  const totalAssessments = all.reduce((s, r) => s + (r.assessments || 0), 0);
  const totalTechnical = all.reduce((s, r) => s + (r.technical_rounds || 0), 0);
  const totalNonTechnical = all.reduce((s, r) => s + (r.non_technical || 0), 0);
  const totalSelfSub = all.reduce((s, r) => s + (r.self_submissions || 0), 0);
  const totalSupportSub = all.reduce((s, r) => s + (r.support_submissions || 0), 0);

  // Unique report dates = days reported
  const uniqueDates = new Set(all.map(r => r.report_date));

  return {
    daysReported: uniqueDates.size,
    totalApplications,
    totalInterviews,
    totalAssessments,
    totalTechnical,
    totalNonTechnical,
    totalSelfSub,
    totalSupportSub,
    records: all.map(r => ({
      id: r.id,
      report_date: r.report_date,
      client_name: r.application_profiles?.client_name || 'Unknown',
      applications_count: r.applications_count || 0,
      interviews_count: r.interviews_count || 0,
      assessments: r.assessments || 0,
      technical_rounds: r.technical_rounds || 0,
      non_technical: r.non_technical || 0,
      self_submissions: r.self_submissions || 0,
      support_submissions: r.support_submissions || 0,
    })),
  };
}

// ─── Security / Risk Summary ──────────────────────────────────────────────────

export async function getSecuritySummary() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const { data: riskEvents, error: rError } = await supabaseAdmin
    .from('attendance_risk_events')
    .select('*')
    .eq('employee_id', session.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (rError) throw rError;

  const { data: devices, error: dError } = await supabaseAdmin
    .from('trusted_devices')
    .select('*')
    .eq('user_id', session.id)
    .order('last_used', { ascending: false });

  if (dError) throw dError;

  const { data: sessions, error: sError } = await supabaseAdmin
    .from('active_sessions')
    .select('*')
    .eq('user_id', session.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (sError) throw sError;

  const events = riskEvents || [];
  const highRisk = events.filter(e => e.risk_level === 'high').length;
  const mediumRisk = events.filter(e => e.risk_level === 'medium').length;
  const lowRisk = events.filter(e => e.risk_level === 'low').length;
  const avgScore = events.length > 0
    ? Math.round(events.reduce((s, e) => s + (e.risk_score || 0), 0) / events.length)
    : 0;

  const trustedDevices = (devices || []).filter(d => d.is_trusted).length;
  const untrustedDevices = (devices || []).filter(d => !d.is_trusted).length;

  return {
    totalEvents: events.length,
    highRisk,
    mediumRisk,
    lowRisk,
    avgScore,
    trustedDevices,
    untrustedDevices,
    riskEvents: events.map(e => ({
      id: e.id,
      action: e.action,
      risk_level: e.risk_level,
      risk_score: e.risk_score,
      risk_reasons: e.risk_reasons || [],
      ip_address: e.ip_address,
      is_office_network: e.is_office_network,
      is_known_device: e.is_known_device,
      created_at: e.created_at,
    })),
    devices: (devices || []).map(d => ({
      id: d.id,
      device_label: d.device_label,
      first_seen: d.first_seen,
      last_used: d.last_used,
      is_trusted: d.is_trusted,
    })),
    sessions: (sessions || []).map(s => ({
      id: s.id,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      created_at: s.created_at,
      last_active: s.last_active,
      is_valid: s.is_valid,
    })),
  };
}
