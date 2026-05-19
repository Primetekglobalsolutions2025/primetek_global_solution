import { redirect } from 'next/navigation';
import { Clock, CalendarCheck, CalendarX, AlertTriangle, ArrowRight, TrendingUp, Briefcase, LogIn, LogOut, CheckCircle2, Plane, Sparkles, User, MapPin, Compass } from 'lucide-react';
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

  // Fetch Employee, Attendance and Leave Balances
  const [
    { data: employee },
    { data: records },
    { data: balances },
    { data: configData }
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('name, employee_id, role, department').eq('id', session.id).single(),
    supabaseAdmin.from('attendance').select('*').eq('employee_id', session.id).order('date', { ascending: false }).limit(10),
    supabaseAdmin.from('leave_balances').select('*').eq('employee_id', session.id),
    supabaseAdmin.from('portal_config').select('config_key, config_value')
  ]);

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
    };
  });

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = empRecords.find((r) => r.date === today);

  const monthRecords = empRecords.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const present = monthRecords.filter(r => r.status.includes('Present') || r.status.includes('Approved WFH')).length;
  const late = monthRecords.filter(r => r.status.toLowerCase() === 'late').length;
  const absent = monthRecords.filter(r => r.status.toLowerCase() === 'absent').length;
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
    <div className="space-y-8 pb-24">
      {/* Premium Hero Section with Glassmorphism */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-navy-900 p-8 md:p-12 text-white shadow-2xl shadow-navy-900/30">
        {/* Mesh Background */}
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[120%] bg-primary-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[80%] bg-emerald-500/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-200">Employee ID: {employee?.employee_id || 'Active'}</span>
            </div>
            
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tighter leading-tight text-white">
                Welcome Back,<br />
                <span className="text-primary-400 drop-shadow-md brightness-125">{firstName}</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base mt-4 max-w-md font-medium leading-relaxed italic">
                Welcome to your dashboard. You can record daily attendance, apply for leaves, and review your assigned clients.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/employee/attendance">
                <Button className="bg-white text-navy-900 hover:bg-white/90 rounded-2xl px-10 py-6 font-black shadow-2xl shadow-white/5 transition-all active:scale-95 group">
                  <Clock className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" /> 
                  {todayRecord ? 'View Today\'s Entry' : 'Clock In / Clock Out'}
                </Button>
              </Link>
              <Link href="/employee/leaves">
                <Button className="bg-primary-500/20 backdrop-blur-md text-primary-200 hover:bg-primary-500/30 rounded-2xl px-8 py-6 font-black border border-primary-500/30 transition-all active:scale-95">
                  Request Leave <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Profile Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-emerald-500 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-navy-900/50 backdrop-blur-2xl rounded-[2rem] p-8 border border-white/10 w-full lg:w-[320px] shadow-2xl">
              <div className="flex items-start justify-between mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-xl shadow-primary-500/20">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Employee Profile</p>
                  <p className="text-sm font-bold text-white">{employee?.employee_id}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Department</p>
                  <p className="text-base font-bold text-white">{employee?.department || 'Operations'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">System Role</p>
                  <p className="text-xs font-bold text-primary-200 uppercase tracking-widest">{employee?.role || 'Staff'}</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Connected</span>
                </div>
                <MapPin className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={stat.label} className="group bg-white rounded-[2rem] p-6 border border-border/60 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-4xl font-black text-navy-900 tracking-tight leading-none mb-1 group-hover:text-primary-600 transition-colors">{stat.value}</p>
            <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Dashboard Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
              <h2 className="font-heading font-black text-navy-900 text-2xl tracking-tight">Attendance Log</h2>
            </div>
            <Link href="/employee/attendance" className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest bg-primary-50 px-4 py-2 rounded-xl transition-all">View All</Link>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-border/60 shadow-sm overflow-hidden">
            <div className="divide-y divide-border/40">
              {empRecords.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-sm font-black text-navy-900 uppercase tracking-tight">No Records Found</p>
                  <p className="text-xs text-text-muted mt-1">Clock in today to start recording your attendance.</p>
                </div>
              ) : (
                empRecords.map((record) => (
                  <div key={record.id} className="p-6 flex items-center gap-6 hover:bg-surface-alt/30 transition-all group">
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white border border-border/60 shadow-sm shrink-0 group-hover:bg-navy-900 group-hover:text-white transition-all duration-500">
                      <span className="text-xl font-black leading-none">
                        {new Date(record.date).getDate()}
                      </span>
                      <span className="text-[9px] uppercase font-black tracking-widest mt-1 opacity-60">
                        {new Date(record.date).toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-black text-navy-900 mb-1 tracking-tight">
                        {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'long' })}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-alt border border-border/40 text-[10px] font-bold text-text-secondary">
                          <LogIn className="w-3 h-3 text-emerald-500" /> {record.check_in}
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-alt border border-border/40 text-[10px] font-bold text-text-secondary">
                          <LogOut className="w-3 h-3 text-primary-500" /> {record.check_out || 'Clocked In'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-navy-900 mb-2">{record.duration_hours > 0 ? `${record.duration_hours}h` : 'Clocked In'}</div>
                      <span className={cn(
                        "inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
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
        <div className="space-y-8">
          {/* Assignments */}
          <div className="relative group overflow-hidden bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-navy-900/20">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-primary-500/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                <Briefcase className="w-6 h-6 text-primary-400" />
              </div>
              <h3 className="text-2xl font-heading font-black mb-3 tracking-tight">Assigned<br />Clients</h3>
              <p className="text-gray-400 text-xs mb-8 leading-relaxed font-medium">
                View and update project profiles and client details assigned to your account.
              </p>
              <Link href="/employee/assigned-profiles">
                <Button className="w-full bg-primary-500 text-white hover:bg-primary-600 font-black rounded-2xl py-5 border-0 shadow-lg shadow-primary-500/20 active:scale-95 transition-all">
                  View Clients <ArrowRight className="w-5 h-5 ml-auto" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Information Card */}
          <div className="bg-emerald-500/5 rounded-[2.5rem] p-8 border border-emerald-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Compass className="w-5 h-5" />
              </div>
              <p className="text-sm font-black text-emerald-900 uppercase tracking-widest">Operational Policy</p>
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
