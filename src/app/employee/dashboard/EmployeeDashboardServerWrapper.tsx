import { redirect } from 'next/navigation';
import { Clock, CalendarCheck, CalendarX, AlertTriangle, ArrowRight, Briefcase, LogIn, LogOut, CheckCircle2, Plane, Sparkles, User, MapPin, Compass, History, ClipboardList } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import { cn, getISTShiftDate } from '@/lib/utils';
import { closeStaleSessionsForEmployee } from '../attendance/actions';

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
    if (['break', 'break (auto)'].includes(s)) {
      return { bg: 'bg-primary-50 text-primary-700 border-primary-200', dot: 'bg-primary-500' };
    }
    return { bg: 'bg-zinc-50 text-zinc-700 border-zinc-200', dot: 'bg-zinc-400' };
  };

  const theme = getTheme();
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium border uppercase tracking-wider',
      theme.bg
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', theme.dot)} />
      {status}
    </span>
  );
}

export default async function EmployeeDashboardServerWrapper() {
  const session = await getSession();
  
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const todayStr = getISTShiftDate();
  await closeStaleSessionsForEmployee(session.id, todayStr);

  // Fetch Employee, Attendance, Leave Balances, and Today's Daily Report Status
  const [
    { data: employee },
    { data: records },
    { data: balances },
    { data: configData },
    { data: dailyReportData }
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('name, employee_id, role, department').eq('id', session.id).single(),
    (() => {
      const now = new Date();
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfQueryStr = startOfPrevMonth.toISOString().split('T')[0];
      return supabaseAdmin
        .from('attendance')
        .select('*')
        .eq('employee_id', session.id)
        .gte('date', startOfQueryStr)
        .order('date', { ascending: false });
    })(),
    supabaseAdmin.from('leave_balances').select('*').eq('employee_id', session.id),
    supabaseAdmin.from('portal_config').select('config_key, config_value'),
    supabaseAdmin.from('profile_daily_metrics').select('id').eq('employee_id', session.id).eq('report_date', todayStr).limit(1)
  ]);

  const hasReportedToday = dailyReportData && dailyReportData.length > 0;

  const configMap = (configData || []).reduce((acc: Record<string, string>, curr: { config_key: string; config_value: string }) => {
    acc[curr.config_key] = curr.config_value;
    return acc;
  }, {});

  const operationalPolicy = configMap['operational_policy'] || "Working from home (WFH) requires checking in with your location. Please ensure you enable location access when submitting a WFH request.";

  const empRecords = (records || []).slice(0, 10).map(r => {
    const checkIn = r.check_in ? new Date(r.check_in) : null;
    const checkOut = r.check_out ? new Date(r.check_out) : null;
    let durationHours = 0;
    if (checkIn && checkOut) {
      durationHours = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 10) / 10;
    }
    return {
      id: r.id,
      date: r.date,
      check_in: checkIn ? checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—',
      check_out: checkOut ? checkOut.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null,
      duration_hours: durationHours,
      status: r.status,
      is_late: r.is_late,
      late_approved: r.late_approved,
      permission_approved: r.permission_approved,
      shift_override: r.shift_override,
      manager_exemption: r.manager_exemption,
    };
  });

  const today = getISTShiftDate();
  const todayRecord = empRecords.find((r) => r.date === today);

  const monthRecords = (records || []).filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const present = monthRecords.filter(r => r.status && (r.status.includes('Present') || r.status.includes('Approved WFH') || r.status.includes('Working') || r.status.includes('Break') || r.status.includes('Break (Auto)') || r.status.includes('Logged Out'))).length;
  const late = monthRecords.filter(r => r.is_late && (!r.status || r.status !== 'Approved WFH') && !r.late_approved && !r.permission_approved && !r.shift_override && !r.manager_exemption).length;
  const absent = monthRecords.filter(r => r.status && r.status.toLowerCase() === 'absent').length;
  const totalRemainingLeaves = (balances || []).reduce((acc, curr) => acc + curr.remaining_days, 0);

  const stats = [
    { label: 'Attendance', value: String(present), icon: CalendarCheck, color: 'text-emerald-650', iconBg: 'bg-emerald-500/10 border-emerald-500/10' },
    { label: 'Leave Credits', value: String(totalRemainingLeaves), icon: Plane, color: 'text-primary-650', iconBg: 'bg-primary-500/10 border-primary-500/10' },
    { label: 'Late Entries', value: String(late), icon: AlertTriangle, color: 'text-amber-650', iconBg: 'bg-amber-500/10 border-amber-500/10' },
    { label: 'Absences', value: String(absent), icon: CalendarX, color: 'text-red-650', iconBg: 'bg-red-500/10 border-red-500/10' },
  ];

  const statusColors: Record<string, string> = {
    present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    late: 'bg-amber-50 text-amber-700 border-amber-200',
    absent: 'bg-red-50 text-red-700 border-red-200',
    'pending wfh': 'bg-violet-50 text-violet-750 border-violet-200',
    'approved wfh': 'bg-emerald-50 text-emerald-750 border-emerald-250',
    'rejected wfh': 'bg-red-50 text-red-700 border-red-200',
    'break': 'bg-primary-50 text-primary-700 border-primary-200',
    'break (auto)': 'bg-primary-50 text-primary-700 border-primary-200',
  };

  const firstName = employee?.name?.split(' ')[0] || 'Employee';

  return (
    <div className="space-y-6 pb-24">
      {/* Vercel layout Hero panel + Brand Navy Background */}
      <div className="relative overflow-hidden rounded-lg bg-navy-900 p-6 md:p-8 text-white shadow-md shadow-navy-900/15">
        {/* Subtle Decorative mesh highlights */}
        <div className="absolute top-[-25%] right-[-15%] w-[45%] h-[130%] bg-primary-500/15 rounded-full blur-[90px] animate-pulse" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[35%] h-[90%] bg-emerald-500/5 rounded-full blur-[70px]" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10 shadow-inner font-mono text-[9px] font-medium uppercase tracking-wider text-primary-200">
              <span>Employee ID: {employee?.employee_id || 'Active'}</span>
            </div>
            
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-white font-sans">
                Welcome Back,<br />
                <span className="text-primary-400 brightness-110">{firstName}</span>
              </h1>
              <p className="text-zinc-400 text-xs mt-2.5 max-w-md font-medium leading-relaxed font-sans">
                Welcome to your dashboard. You can record daily attendance, apply for leaves, and review your assigned clients.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/employee/attendance">
                <Button className="bg-white text-navy-900 hover:bg-zinc-100 rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all font-sans flex items-center group">
                  <Clock className="w-3.5 h-3.5 mr-2 group-hover:rotate-12 transition-transform text-navy-900" /> 
                  {todayRecord ? 'View Today\'s Entry' : 'Clock In / Out'}
                </Button>
              </Link>
              <Link href="/employee/leaves">
                <Button className="bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/40 rounded-md px-4 py-2 text-xs font-semibold transition-all font-sans flex items-center">
                  Request Leave <ArrowRight className="w-3.5 h-3.5 ml-2 text-white" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Profile Card */}
          <div className="relative">
            <div className="bg-navy-950/40 rounded-lg p-5 border border-white/10 w-full lg:w-[280px] shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-primary-300">
                  <User className="w-5 h-5 text-primary-300" />
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider">Employee Profile</p>
                  <p className="text-xs font-mono font-semibold text-white mt-0.5">{employee?.employee_id}</p>
                </div>
              </div>
              
              <div className="space-y-3 font-sans">
                <div>
                  <p className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Department</p>
                  <p className="text-sm font-semibold text-white">{employee?.department || 'Operations'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider mb-0.5">System Role</p>
                  <p className="text-xs font-semibold text-primary-200 uppercase tracking-wider">{employee?.role || 'Staff'}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono font-semibold text-emerald-500 uppercase tracking-wider">Connected</span>
                </div>
                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Only Quick Actions Grid */}
      <div className="block md:hidden bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs space-y-3">
        <h3 className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/employee/attendance" className="col-span-2">
            <button className="w-full flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 hover:border-primary-500 bg-white text-navy-900 font-semibold text-sm active:scale-98 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span>{todayRecord ? 'Check Today\'s Attendance' : 'Clock In / Out'}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </button>
          </Link>
          <Link href="/employee/daily-report" className="col-span-2">
            <button className="w-full flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 hover:border-primary-500 bg-white text-navy-900 font-semibold text-sm active:scale-98 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4 text-zinc-500" />
                <span>{hasReportedToday ? "Daily Report: Submitted ✅" : "Daily Report: Pending ⏳"}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </button>
          </Link>
          <Link href="/employee/leaves">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-lg bg-white border border-zinc-200 hover:border-primary-500/50 active:scale-95 transition-all text-center gap-1.5 shadow-2xs cursor-pointer">
              <CalendarX className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] font-semibold text-navy-900 uppercase tracking-tight">Request Leave</span>
            </button>
          </Link>
          <Link href="/employee/attendance#history">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-lg bg-white border border-zinc-200 hover:border-primary-500/50 active:scale-95 transition-all text-center gap-1.5 shadow-2xs cursor-pointer">
              <History className="w-5 h-5 text-emerald-500" />
              <span className="text-[10px] font-semibold text-navy-900 uppercase tracking-tight">View History</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Modern Stats Grid - Vercel style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="group bg-white rounded-lg p-5 border border-zinc-200/80 flex flex-col gap-4 relative hover:border-primary-500/50 transition-all duration-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className={cn(
                'w-8 h-8 rounded-md flex items-center justify-center transition-transform duration-300 group-hover:scale-105 border',
                stat.color,
                stat.iconBg
              )}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-navy-900 font-sans leading-none">{stat.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mt-2 font-sans">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Logs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">Attendance Log</h2>
            </div>
            <Link href="/employee/attendance" className="text-[9px] font-mono font-medium text-primary-700 hover:text-primary-800 uppercase tracking-wider bg-primary-50/50 border border-primary-200/40 px-3 py-1 rounded transition-all">View All</Link>
          </div>
          
          <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {empRecords.length === 0 ? (
                <div className="p-12 text-center font-sans">
                  <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                    <Clock className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider">No Records Found</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Clock in today to start recording your attendance.</p>
                </div>
              ) : (
                empRecords.map((record) => (
                  <div key={record.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50/50 transition-all group">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded bg-zinc-50 border border-zinc-200 shrink-0 transition-colors">
                      <span className="text-lg font-bold leading-none text-navy-900 font-sans">
                        {new Date(record.date).getDate()}
                      </span>
                      <span className="text-[9px] uppercase font-semibold text-zinc-450 tracking-wider mt-0.5 font-sans">
                        {new Date(record.date).toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy-900 mb-1 tracking-tight font-sans">
                        {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'long' })}
                      </p>
                      <div className="flex items-center gap-2 font-mono text-[9px]">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-150 text-zinc-500">
                          <LogIn className="w-2.5 h-2.5 text-emerald-500" /> {record.check_in}
                        </div>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-150 text-zinc-500">
                          <LogOut className="w-2.5 h-2.5 text-red-400" /> {record.check_out || 'Clocked In'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-navy-900 mb-1.5 font-mono">{record.duration_hours > 0 ? `${record.duration_hours}h` : 'Clocked In'}</div>
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded text-[8px] font-mono font-medium border uppercase tracking-wider",
                        statusColors[record.status?.toLowerCase()] || 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      )}>
                        <span className={cn("w-1 h-1 rounded-full mr-1 shrink-0", record.status?.toLowerCase()?.includes('late') ? 'bg-amber-500' : 'bg-emerald-500')} />
                        {record.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Matrix */}
        <div className="space-y-6">
          {/* Daily Report Status Card */}
          <div className="bg-white border border-zinc-200 hover:border-primary-500/50 rounded-lg p-6 relative overflow-hidden transition-all duration-200 shadow-2xs">
            <div className="relative z-10">
              <div className={cn(
                "w-8 h-8 rounded border flex items-center justify-center mb-4 text-white shadow-3xs",
                hasReportedToday ? "bg-emerald-500 border-emerald-600" : "bg-primary-500 border-primary-600"
              )}>
                <ClipboardList className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-base font-bold mb-1.5 tracking-tight text-navy-900 font-sans">Daily Report Status</h3>
              <p className="text-zinc-550 text-xs mb-5 leading-relaxed font-medium font-sans">
                {hasReportedToday 
                  ? "You have already submitted your daily recruitment metrics report for today. Thank you!"
                  : "You have not submitted today's report. Please fill your daily recruitment metrics."}
              </p>
              <Link href="/employee/daily-report" className="block w-full">
                <Button className={cn(
                  "w-full text-xs font-semibold rounded-md py-2 border-0 shadow-sm transition-all font-sans flex items-center justify-center gap-1.5",
                  hasReportedToday 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                    : "bg-primary-500 hover:bg-primary-650 text-white"
                )}>
                  <span>{hasReportedToday ? "View / Edit Report" : "Submit Daily Report"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Assignments */}
          <div className="relative overflow-hidden bg-navy-900 rounded-lg p-6 text-white shadow-md shadow-navy-900/10">
            <div className="absolute top-[-25%] right-[-15%] w-20 h-20 bg-primary-500/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <Briefcase className="w-4.5 h-4.5 text-primary-400" />
              </div>
              <h3 className="text-base font-bold mb-1.5 tracking-tight font-sans">Assigned Clients</h3>
              <p className="text-zinc-400 text-xs mb-5 leading-relaxed font-medium font-sans">
                View and update project profiles and client details assigned to your account.
              </p>
              <Link href="/employee/assigned-profiles">
                <Button className="w-full bg-primary-500 hover:bg-primary-650 text-white text-xs font-semibold rounded-md py-2 border-0 shadow-sm transition-all font-sans flex items-center justify-center gap-1.5">
                  View Clients <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Information Card */}
          <div className="bg-primary-50/40 rounded-lg p-5 border border-primary-100/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <CheckCircle2 className="w-12 h-12 text-primary-500" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded bg-primary-500 text-white flex items-center justify-center shadow-3xs">
                <Compass className="w-4 h-4 text-white" />
              </div>
              <p className="text-[10px] font-mono font-semibold text-primary-800 uppercase tracking-wider">Operational Policy</p>
            </div>
            <p className="text-xs text-primary-800/80 leading-relaxed font-medium italic font-sans">
              &ldquo;{operationalPolicy}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
