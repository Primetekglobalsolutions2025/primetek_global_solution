import { redirect } from 'next/navigation';
import { Clock, CalendarCheck, CalendarX, AlertTriangle, ArrowRight, TrendingUp, Briefcase, LogIn, LogOut, CheckCircle2, Plane, Sparkles, User, MapPin, Compass, History, ClipboardList } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default async function EmployeeAppDashboard() {
  const session = await getSession();
  
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const todayStr = new Date().toLocaleDateString('en-CA');

  // Fetch Employee, Attendance, Leave Balances, and Today's Daily Report Status
  const [
    { data: employee },
    { data: records },
    { data: balances },
    { data: configData },
    { data: dailyReportData }
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('name, employee_id, role, department').eq('id', session.id).single(),
    supabaseAdmin.from('attendance').select('*').eq('employee_id', session.id).order('date', { ascending: false }).limit(10),
    supabaseAdmin.from('leave_balances').select('*').eq('employee_id', session.id),
    supabaseAdmin.from('portal_config').select('config_key, config_value'),
    supabaseAdmin.from('profile_daily_metrics').select('id').eq('employee_id', session.id).eq('report_date', todayStr).limit(1)
  ]);

  const hasReportedToday = dailyReportData && dailyReportData.length > 0;

  const configMap = (configData || []).reduce((acc: any, curr: any) => {
    acc[curr.config_key] = curr.config_value;
    return acc;
  }, {});

  const operationalPolicy = configMap['operational_policy'] || "Working from home (WFH) requires checking in with your location. Please ensure you enable location access when submitting a WFH request.";

  const empRecords = (records || []).map(r => {
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

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = empRecords.find((r) => r.date === today);

  const monthRecords = empRecords.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const present = monthRecords.filter(r => r.status && (r.status.includes('Present') || r.status.includes('Approved WFH') || r.status.includes('Working') || r.status.includes('On Break') || r.status.includes('Logged Out'))).length;
  const late = monthRecords.filter(r => r.is_late && (!r.status || r.status !== 'Approved WFH') && !r.late_approved && !r.permission_approved && !r.shift_override && !r.manager_exemption).length;
  const absent = monthRecords.filter(r => r.status && r.status.toLowerCase() === 'absent').length;
  const totalRemainingLeaves = (balances || []).reduce((acc, curr) => acc + curr.remaining_days, 0);

  const stats = [
    { label: 'Attendance', value: String(present), icon: CalendarCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Leave Credits', value: String(totalRemainingLeaves), icon: Plane, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Late Entries', value: String(late), icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Absences', value: String(absent), icon: CalendarX, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  const statusColors: Record<string, string> = {
    present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    absent: 'bg-red-500/10 text-red-600 border-red-500/20',
    'pending wfh': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    'approved wfh': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    'rejected wfh': 'bg-red-500/10 text-red-600 border-red-500/20',
  };

  const firstName = employee?.name?.split(' ')[0] || 'Employee';

  return (
    <div className="space-y-6 pb-24">
      {/* Premium Hero Section with Glassmorphism */}
      <div className="relative overflow-hidden rounded-xl bg-navy-900 p-6 md:p-8 text-white shadow-xl shadow-navy-900/20">
        {/* Mesh Background */}
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[120%] bg-primary-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[80%] bg-emerald-500/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-primary-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary-200">Employee ID: {employee?.employee_id || 'Active'}</span>
            </div>
            
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-white">
                Welcome Back,<br />
                <span className="text-primary-400 drop-shadow-sm brightness-125">{firstName}</span>
              </h1>
              <p className="text-gray-400 text-sm mt-2.5 max-w-md font-medium leading-relaxed">
                Welcome to your dashboard. You can record daily attendance, apply for leaves, and review your assigned clients.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/employee/attendance">
                <Button className="bg-white text-navy-900 hover:bg-white/90 rounded-lg px-5 py-2 font-semibold shadow-sm transition-all group">
                  <Clock className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" /> 
                  {todayRecord ? 'View Today\'s Entry' : 'Clock In / Out'}
                </Button>
              </Link>
              <Link href="/employee/leaves">
                <Button className="bg-primary-500/20 backdrop-blur-md text-primary-200 hover:bg-primary-500/30 rounded-lg px-4 py-2 font-semibold border border-primary-500/30 transition-all">
                  Request Leave <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Profile Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-emerald-500 rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-1000" />
            <div className="relative bg-navy-900/50 backdrop-blur-2xl rounded-xl p-5 border border-white/10 w-full lg:w-[280px] shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-primary-400 uppercase tracking-wider">Employee Profile</p>
                  <p className="text-xs font-bold text-white">{employee?.employee_id}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Department</p>
                  <p className="text-sm font-bold text-white">{employee?.department || 'Operations'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">System Role</p>
                  <p className="text-xs font-bold text-primary-200 uppercase tracking-wider">{employee?.role || 'Staff'}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Connected</span>
                </div>
                <MapPin className="w-3.5 h-3.5 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Only Quick Actions Grid */}
      <div className="block md:hidden bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-border/50 shadow-sm space-y-3">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/employee/attendance" className="col-span-2">
            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" />
                <span>{todayRecord ? 'Check Today\'s Attendance' : 'Clock In / Out'}</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/employee/daily-report" className="col-span-2">
            <button className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer text-white",
              hasReportedToday 
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600" 
                : "bg-gradient-to-r from-amber-500 to-amber-600"
            )}>
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5" />
                <span>{hasReportedToday ? "Daily Report: Submitted ✅" : "Daily Report: Pending ⏳"}</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/employee/leaves">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-border/60 hover:bg-surface-alt active:scale-95 transition-all text-center gap-1.5 shadow-sm cursor-pointer">
              <CalendarX className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">Request Leave</span>
            </button>
          </Link>
          <Link href="/employee/attendance#history">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-border/60 hover:bg-surface-alt active:scale-95 transition-all text-center gap-1.5 shadow-sm cursor-pointer">
              <History className="w-5 h-5 text-emerald-500" />
              <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">View History</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={stat.label} className="group bg-white rounded-xl p-4 border border-border/60 shadow-sm hover:shadow-md transition-all duration-200">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-navy-900 tracking-tight leading-none mb-1 group-hover:text-primary-600 transition-colors">{stat.value}</p>
            <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">{stat.label}</p>
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
              <h2 className="text-lg font-semibold text-navy-900 tracking-tight">Attendance Log</h2>
            </div>
            <Link href="/employee/attendance" className="text-[9px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider bg-primary-50 px-3 py-1.5 rounded-lg transition-all">View All</Link>
          </div>
          
          <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="divide-y divide-border/40">
              {empRecords.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-text-muted" />
                  </div>
                  <p className="text-xs font-bold text-navy-900 uppercase tracking-wider">No Records Found</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Clock in today to start recording your attendance.</p>
                </div>
              ) : (
                empRecords.map((record) => (
                  <div key={record.id} className="p-4 flex items-center gap-4 hover:bg-surface-alt/30 transition-all group">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white border border-border/60 shadow-sm shrink-0 group-hover:bg-navy-900 group-hover:text-white transition-all duration-200">
                      <span className="text-lg font-bold leading-none">
                        {new Date(record.date).getDate()}
                      </span>
                      <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5 opacity-60">
                        {new Date(record.date).toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900 mb-1 tracking-tight">
                        {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'long' })}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-alt border border-border/40 text-[9px] font-semibold text-text-secondary">
                          <LogIn className="w-2.5 h-2.5 text-emerald-500" /> {record.check_in}
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-alt border border-border/40 text-[9px] font-semibold text-text-secondary">
                          <LogOut className="w-2.5 h-2.5 text-primary-500" /> {record.check_out || 'Clocked In'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-navy-900 mb-1.5">{record.duration_hours > 0 ? `${record.duration_hours}h` : 'Clocked In'}</div>
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border",
                        statusColors[record.status?.toLowerCase()] || statusColors.present
                      )}>
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
          <div className={cn(
            "relative group overflow-hidden rounded-xl p-6 border shadow-md transition-all duration-200",
            hasReportedToday 
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-950" 
              : "bg-amber-500/5 border-amber-500/20 text-amber-950"
          )}>
            <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center mb-4 text-white shadow-sm",
                hasReportedToday ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              )}>
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-1.5 tracking-tight text-navy-900">Daily Report Status</h3>
              <p className="text-text-secondary text-xs mb-5 leading-relaxed font-medium">
                {hasReportedToday 
                  ? "You have already submitted your daily recruitment metrics report for today. Thank you!"
                  : "You have not submitted today's report. Please fill your daily recruitment metrics."}
              </p>
              <Link href="/employee/daily-report" className="block w-full">
                <Button className={cn(
                  "w-full font-semibold rounded-lg py-2 border-0 shadow-sm active:scale-95 transition-all",
                  hasReportedToday 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                    : "bg-amber-500 hover:bg-amber-600 text-white"
                )}>
                  <span>{hasReportedToday ? "View / Edit Report" : "Submit Daily Report"}</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Assignments */}
          <div className="relative group overflow-hidden bg-navy-900 rounded-xl p-6 text-white shadow-md shadow-navy-900/20">
            <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-primary-500/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                <Briefcase className="w-5 h-5 text-primary-400" />
              </div>
              <h3 className="text-lg font-bold mb-1.5 tracking-tight">Assigned Clients</h3>
              <p className="text-gray-400 text-xs mb-5 leading-relaxed font-medium">
                View and update project profiles and client details assigned to your account.
              </p>
              <Link href="/employee/assigned-profiles">
                <Button className="w-full bg-primary-500 text-white hover:bg-primary-600 font-semibold rounded-lg py-2 border-0 shadow-sm active:scale-95 transition-all">
                  View Clients <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Information Card */}
          <div className="bg-emerald-500/5 rounded-xl p-6 border border-emerald-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                <Compass className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Operational Policy</p>
            </div>
            <p className="text-xs text-emerald-800/70 leading-relaxed font-medium italic">
              "{operationalPolicy}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
