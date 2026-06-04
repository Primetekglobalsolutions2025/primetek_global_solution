import { redirect } from 'next/navigation';
import { Clock, CalendarCheck, CalendarX, AlertTriangle, ArrowRight, Briefcase, LogIn, LogOut, CheckCircle2, Plane, User, MapPin, Compass, History, ClipboardList } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import { cn, getISTShiftDate } from '@/lib/utils';
import { closeStaleSessions } from '../attendance/actions';
import StatusBadge from '@/components/ui/StatusBadge';
import { getCachedPortalConfig } from '@/lib/cache/portal-config';
import EmployeeDashboardClient from './EmployeeDashboardClient';
import { getHolidays } from '@/app/admin/holidays/actions';
import EmployeeApplicationsList from './EmployeeApplicationsList';

export default async function EmployeeDashboardServerWrapper() {
  const session = await getSession();
  
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const todayStr = getISTShiftDate();

  await closeStaleSessions();

  // Fetch Employee, Attendance, Leave Balances, Today's Daily Report Status, and Master Job Tracker Sheet
  const [
    { data: employee },
    { data: records },
    { data: balances },
    configData,
    { data: dailyReportData },
    { data: sheetRecord }
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('name, employee_id, role, department, designation').eq('id', session.id).single(),
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
    getCachedPortalConfig(),
    supabaseAdmin.from('profile_daily_metrics').select('id').eq('employee_id', session.id).eq('report_date', todayStr).limit(1),
    supabaseAdmin.from('job_tracker_sheets').select('content').eq('sheet_name', 'Master_Job_Tracker').maybeSingle()
  ]);

  const hasReportedToday = dailyReportData && dailyReportData.length > 0;
  
  const employeeName = employee?.name || '';
  const myApplications: any[] = [];

  if (sheetRecord && sheetRecord.content && sheetRecord.content.sheets) {
    const content = sheetRecord.content;
    const urlClaims: Record<string, string[]> = {};
    const allApplications: any[] = [];

    // Scan all employee sheets
    Object.keys(content.sheets).forEach(id => {
      const sheet = content.sheets[id];
      const name = sheet.name;
      if (name === 'Home' || name === 'Dashboard') return;

      const cellData = sheet.cellData || {};
      let maxRow = -1;
      Object.keys(cellData).forEach(rowIdx => {
        const r = parseInt(rowIdx, 10);
        if (!isNaN(r) && r > maxRow) maxRow = r;
      });

      for (let r = 1; r <= maxRow; r++) {
        const row = cellData[r.toString()];
        if (!row) continue;
        
        const jobRole = row['1']?.v || '';
        const clientName = row['2']?.v || '';
        const url = row['3']?.v || '';
        const dateStr = row['0']?.v || '';

        if (!jobRole && !clientName) continue;

        const urlKey = url.toString().trim().toLowerCase();
        if (urlKey) {
          if (!urlClaims[urlKey]) {
            urlClaims[urlKey] = [];
          }
          if (!urlClaims[urlKey].includes(name)) {
            urlClaims[urlKey].push(name);
          }
        }

        allApplications.push({
          employeeName: name,
          timestamp: dateStr,
          jobRole,
          clientName,
          url
        });
      }
    });

    // Deduplicate and filter applications for this employee
    const seenUrls: Record<string, boolean> = {};
    allApplications.forEach(app => {
      const urlKey = app.url.toString().trim().toLowerCase();
      const claimers = urlClaims[urlKey] ? urlClaims[urlKey] : [app.employeeName];
      const isLoggedByMe = app.employeeName === employeeName;
      const isClaimedByMe = claimers.includes(employeeName);

      if (isLoggedByMe || isClaimedByMe) {
        if (!urlKey) {
          myApplications.push({
            ...app,
            claimedBy: claimers.join(', ')
          });
          return;
        }
        if (!seenUrls[urlKey]) {
          seenUrls[urlKey] = true;
          myApplications.push({
            ...app,
            claimedBy: claimers.join(', ')
          });
        }
      }
    });
  }

  // Sort applications by date descending (newest first)
  myApplications.sort((a, b) => {
    const da = new Date(a.timestamp).getTime();
    const db = new Date(b.timestamp).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return db - da;
  });

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

  const firstName = employee?.name?.split(' ')[0] || 'Employee';
  const isAdmin = session.role === 'admin' || session.role === 'hr';

  // Fetch holidays from public.holidays table or use default fallback if empty
  const holidaysRes = await getHolidays();
  let holidays = holidaysRes.success && holidaysRes.holidays.length > 0 ? holidaysRes.holidays : [];
  
  if (holidays.length === 0) {
    const currentYear = new Date().getFullYear();
    holidays = [
      { id: 'new-year', title: 'New Year Day', date: `${currentYear}-01-01`, type: 'Public Holiday' },
      { id: 'republic-day', title: 'Republic Day', date: `${currentYear}-01-26`, type: 'Public Holiday' },
      { id: 'may-day', title: 'May Day', date: `${currentYear}-05-01`, type: 'Company Holiday' },
      { id: 'ind-day', title: 'Independence Day', date: `${currentYear}-08-15`, type: 'Company Holiday' },
      { id: 'gandhi-jayanti', title: 'Gandhi Jayanti', date: `${currentYear}-10-02`, type: 'Public Holiday' },
      { id: 'christmas', title: 'Christmas', date: `${currentYear}-12-25`, type: 'Company Holiday' },
    ];
  }

  // Mobile today record
  const rawTodayRecord = (records || []).find((r) => r.date === todayStr);
  const mobileTodayRecord = rawTodayRecord ? {
    check_in: rawTodayRecord.check_in || '',
    check_out: rawTodayRecord.check_out || null,
    duration_hours: rawTodayRecord.check_in && rawTodayRecord.check_out
      ? (new Date(rawTodayRecord.check_out).getTime() - new Date(rawTodayRecord.check_in).getTime()) / (1000 * 60 * 60)
      : 0,
    status: rawTodayRecord.status || '',
  } : null;

  return (
    <>
      {/* ── MOBILE VIEW (hidden on md+) ── */}
      <div className="block md:hidden">
        <EmployeeDashboardClient
          employee={employee ? {
            name: employee.name,
            employee_id: employee.employee_id,
            role: employee.role,
            department: employee.department,
            designation: (employee as { designation?: string }).designation,
          } : null}
          todayRecord={mobileTodayRecord}
          totalRemainingLeaves={totalRemainingLeaves}
          initialHolidays={holidays}
          isAdmin={isAdmin}
          applications={myApplications}
        />
      </div>

      {/* ── DESKTOP VIEW (hidden on mobile) ── */}
      <div className="hidden md:block">
        <div className="space-y-6 pb-6">
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
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
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
                      <StatusBadge status={record.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Job Applications Section */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">My Job Applications</h2>
            </div>
            
            <EmployeeApplicationsList 
              applications={myApplications} 
              employeeName={employeeName} 
            />
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
          <div className="bg-white border border-zinc-200 hover:border-primary-500/50 rounded-lg p-6 relative overflow-hidden transition-all duration-200 shadow-2xs">
            <div className="absolute top-[-25%] right-[-15%] w-20 h-20 bg-primary-500/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <div className="w-8 h-8 rounded bg-primary-500 border border-primary-600 flex items-center justify-center mb-4 text-white shadow-3xs">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-base font-bold mb-1.5 tracking-tight text-navy-900 font-sans">Assigned Clients</h3>
              <p className="text-zinc-550 text-xs mb-5 leading-relaxed font-medium font-sans">
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
      </div>
    </>
  );
}
