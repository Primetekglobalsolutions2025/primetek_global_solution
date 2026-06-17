import { MessageSquare, Users, Clock, Settings, ArrowRight, CheckSquare, TrendingUp, Zap, FileUser, Activity, Coffee, MapPin, AlertTriangle, ShieldAlert, Smartphone, LogOut as LogOutIcon, Gavel, LogIn } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatDate, cn, getISTShiftDate } from '@/lib/utils';
import Link from 'next/link';
import AnalyticsCharts from '@/components/admin/AnalyticsCharts';
import DashboardGreeting from '@/components/admin/DashboardGreeting';
import { getSession } from '@/lib/auth';
import { Suspense } from 'react';
import { StatsCardsSkeleton, ChartsSkeleton, SystemStatusSkeleton, ActivityFeedSkeleton } from './skeletons';

export const dynamic = 'force-dynamic';

// ─── 1. ASYNC OPERATIONAL KPI GRID ───
async function OperationalKPIGrid() {
  const todayIST = getISTShiftDate(new Date());

  let activeEmployees = 0;
  let activeBreaks = 0;
  let idleSessions = 0;
  let gpsAlerts = 0;
  let autoBreaks = 0;
  let pendingApprovals = 0;
  let pendingDisputes = 0;
  let mobileSessions = 0;
  let autoLogouts = 0;

  try {
    const [
      activeRes,
      breakRes,
      mobileRes,
      pendingLeavesRes,
      pendingWFHRes,
      disputesRes,
      idleRes,
      gpsRes,
      autoBreakRes,
      forceLogoutRes,
    ] = await Promise.all([
      supabaseAdmin.from('attendance').select('id, status, device_type', { count: 'exact' }).eq('date', todayIST).is('check_out', null),
      supabaseAdmin.from('attendance').select('id', { count: 'exact' }).eq('date', todayIST).in('status', ['Break', 'Break (Auto)']),
      supabaseAdmin.from('attendance').select('id', { count: 'exact' }).eq('date', todayIST).is('check_out', null).eq('device_type', 'mobile'),
      supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true }).ilike('status', 'Pending'),
      supabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).ilike('status', 'Pending WFH'),
      supabaseAdmin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).eq('date', todayIST).eq('status', 'PRODUCTIVE_TIMER_PAUSED'),
      supabaseAdmin.from('attendance_events').select('id', { count: 'exact', head: true }).eq('event_type', 'GPS_EXIT').gte('event_timestamp', todayIST + 'T00:00:00'),
      supabaseAdmin.from('attendance_events').select('id', { count: 'exact', head: true }).eq('event_type', 'AUTO_BREAK_TRIGGERED').gte('event_timestamp', todayIST + 'T00:00:00'),
      supabaseAdmin.from('attendance_events').select('id', { count: 'exact', head: true }).eq('event_type', 'FORCE_LOGOUT').gte('event_timestamp', todayIST + 'T00:00:00'),
    ]);

    const activeData = activeRes.data || [];
    activeEmployees = activeData.length;
    activeBreaks = breakRes.count || 0;
    mobileSessions = mobileRes.count || 0;
    pendingApprovals = (pendingLeavesRes.count || 0) + (pendingWFHRes.count || 0);
    pendingDisputes = disputesRes.count || 0;
    idleSessions = idleRes.count || 0;
    gpsAlerts = gpsRes.count || 0;
    autoBreaks = autoBreakRes.count || 0;
    autoLogouts = forceLogoutRes.count || 0;

  } catch (err) {
    console.error('Failed to load operational KPIs:', err);
  }

  const kpis = [
    { label: 'Active Now', value: activeEmployees, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/15', href: '/admin/attendance', pulse: true },
    { label: 'Break', value: activeBreaks, icon: Coffee, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/15', href: '/admin/attendance' },
    { label: 'Idle Sessions', value: idleSessions, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/15', href: '/admin/attendance' },
    { label: 'GPS Alerts', value: gpsAlerts, icon: MapPin, color: 'text-orange-600', bg: 'bg-orange-500/10 border-orange-500/15', href: '/admin/attendance' },
    { label: 'Auto-Breaks', value: autoBreaks, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-500/10 border-rose-500/15', href: '/admin/audit' },
    { label: 'Approvals', value: pendingApprovals, icon: CheckSquare, color: 'text-violet-600', bg: 'bg-violet-500/10 border-violet-500/15', href: '/admin/approvals' },
    { label: 'Disputes', value: pendingDisputes, icon: Gavel, color: 'text-indigo-600', bg: 'bg-indigo-500/10 border-indigo-500/15', href: '/admin/approvals' },
    { label: 'Mobile-Only', value: mobileSessions, icon: Smartphone, color: 'text-sky-600', bg: 'bg-sky-500/10 border-sky-500/15', href: '/admin/attendance' },
    { label: 'Auto-Logouts', value: autoLogouts, icon: LogOutIcon, color: 'text-zinc-600', bg: 'bg-zinc-500/10 border-zinc-500/15', href: '/admin/audit' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
      {kpis.map((kpi) => (
        <Link 
          key={kpi.label} 
          href={kpi.href}
          className="group bg-white rounded-xl p-3.5 lg:p-4 border border-zinc-250/70 flex flex-col items-center gap-2.5 relative hover:border-primary-500/45 hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-out cursor-pointer text-center overflow-hidden"
        >
          {/* Subtle top border accent on hover */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Shimmer on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-108 border',
            kpi.color,
            kpi.bg
          )}>
            <kpi.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight text-navy-950 font-sans leading-none">
              {kpi.value}
              {kpi.pulse && kpi.value > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1 align-middle" />}
            </p>
            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400 mt-1.5 font-sans leading-tight">{kpi.label}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

interface AttendanceEvent {
  id: string;
  session_id: string;
  employee_id: string;
  event_type: string;
  event_timestamp: string;
  payload: any;
  client_ip: string;
}

// ─── 2. ASYNC REALTIME ACTIVITY FEED ───
async function RealtimeActivityFeed() {
  const todayIST = getISTShiftDate(new Date());

  let events: AttendanceEvent[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('attendance_events')
      .select('id, session_id, employee_id, event_type, event_timestamp, payload, client_ip')
      .gte('event_timestamp', todayIST + 'T00:00:00')
      .order('event_timestamp', { ascending: false })
      .limit(15);
    events = data || [];
  } catch (err) {
    console.error('Failed to load activity feed:', err);
  }

  // Resolve employee names
  const empIds = [...new Set(events.map(e => e.employee_id).filter(Boolean))];
  const empMap: Record<string, string> = {};
  if (empIds.length > 0) {
    const { data: emps } = await supabaseAdmin.from('employees').select('id, name').in('id', empIds);
    if (emps) {
      emps.forEach(e => { empMap[e.id] = e.name; });
    }
  }

  const eventConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
    'CLOCK_IN': { color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Clocked In', icon: LogIn },
    'CLOCK_OUT': { color: 'text-red-600', bg: 'bg-red-500/10', label: 'Clocked Out', icon: LogOutIcon },
    'FORCE_LOGOUT': { color: 'text-red-700', bg: 'bg-red-500/15', label: 'Force Logout', icon: LogOutIcon },
    'BREAK_STARTED': { color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Break Started', icon: Coffee },
    'BREAK_ENDED': { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Break Ended', icon: Clock },
    'AUTO_BREAK_TRIGGERED': { color: 'text-rose-600', bg: 'bg-rose-500/10', label: 'Auto-Break', icon: ShieldAlert },
    'GPS_EXIT': { color: 'text-orange-600', bg: 'bg-orange-500/10', label: 'GPS Exit', icon: MapPin },
    'GPS_REENTRY': { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'GPS Reentry', icon: MapPin },
    'IDLE_WARNING': { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Idle Warning', icon: AlertTriangle },
    'ADMIN_OVERRIDE': { color: 'text-violet-600', bg: 'bg-violet-500/10', label: 'Admin Override', icon: Settings },
    'HEARTBEAT': { color: 'text-zinc-400', bg: 'bg-zinc-500/5', label: 'Heartbeat', icon: Activity },
  };

  const formatRelativeTime = (ts: string) => {
    const now = new Date();
    const then = new Date(ts);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  // Filter out HEARTBEAT events for the feed (too noisy)
  const filteredEvents = events.filter(e => e.event_type !== 'HEARTBEAT');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary-500 rounded-full" />
          <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">Live Activity Feed</h2>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <Link href="/admin/audit" className="text-[9px] font-mono font-medium text-primary-700 hover:text-primary-800 uppercase tracking-wider bg-primary-50/50 border border-primary-200/40 px-3 py-1 rounded transition-all">
          View All
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 hover:border-primary-500/40 hover:shadow-xs transition-all duration-300 p-5 relative">
        {filteredEvents.length === 0 ? (
          <div className="py-10 text-center">
            <Activity className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-400 font-semibold">No activity events recorded today</p>
          </div>
        ) : (
          <div className="relative pl-8 space-y-6">
            {/* The vertical gradient timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-gradient-to-b from-primary-400/50 via-zinc-200/50 to-transparent z-0" />
            
            {filteredEvents.slice(0, 12).map((evt) => {
              const config = eventConfig[evt.event_type] || { color: 'text-zinc-500', bg: 'bg-zinc-500/5', label: evt.event_type, icon: Activity };
              const empName = empMap[evt.employee_id] || 'Unknown';
              const EvtIcon = config.icon || Activity;
              return (
                <div key={evt.id} className="relative z-10 flex items-center justify-between gap-3 group">
                  {/* Floating Circular Bubble Icon */}
                  <div className={cn(
                    'absolute left-3 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center border border-white shadow-xs z-10 transition-transform duration-300 group-hover:scale-110', 
                    config.bg
                  )}>
                    <EvtIcon className={cn('w-3 h-3', config.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-navy-900 truncate">{empName}</span>
                      <span className={cn('text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-current/10', config.bg, config.color)}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400 shrink-0">{formatRelativeTime(evt.event_timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 3. ASYNC PERFORMANCE CHARTS SECTION ───
async function PerformanceChartsSection() {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return getISTShiftDate(d);
  }).reverse();

  const last4Weeks = Array.from({ length: 4 }, (_, i) => {
    const start = new Date();
    start.setDate(start.getDate() - (i + 1) * 7);
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    return { start, end, label: `W${4-i}` };
  }).reverse();

  let employeesCount = 0;
  let attendanceTrends: any[] = [];
  let inquiryTrends: any[] = [];

  try {
    const [employeesRes, attendanceTrendsRes, inquiryTrendsRes] = await Promise.all([
      supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('attendance').select('date, status').in('date', last7Days),
      supabaseAdmin.from('inquiries').select('created_at').gte('created_at', last4Weeks[0].start.toISOString()),
    ]);
    employeesCount = employeesRes.count || 0;
    attendanceTrends = attendanceTrendsRes.data || [];
    inquiryTrends = inquiryTrendsRes.data || [];
  } catch (err) {
    console.error('Failed to load performance metrics from database:', err);
  }

  const attendanceData = last7Days.map(date => {
    const dayRecords = (attendanceTrends || []).filter(r => r.date === date);
    const present = dayRecords.filter(r => r.status && !r.status.toLowerCase().includes('absent') && !r.status.toLowerCase().includes('rejected')).length;
    const percentage = employeesCount ? Math.round((present / employeesCount) * 100) : 0;
    return { 
      label: new Date(date).toLocaleDateString('en-US', { weekday: 'short' })[0], 
      value: percentage 
    };
  });

  const applicationData = last4Weeks.map(week => {
    const count = (inquiryTrends || []).filter(inq => {
      const d = new Date(inq.created_at);
      return d >= week.start && d < week.end;
    }).length;
    return { label: week.label, value: count };
  });

  return (
    <AnalyticsCharts 
      attendanceData={attendanceData}
      applicationData={applicationData}
    />
  );
}

export interface SystemHealthNode {
  node_name: string;
  status: string;
  color: string;
  last_check?: string;
  updated_at?: string;
}

// ─── 4. ASYNC SYSTEM STATUS SECTION ───
async function SystemStatusSection() {
  const defaultNodes: SystemHealthNode[] = [
    { node_name: 'Database', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'API Gateway', status: 'Optimal', color: 'bg-emerald-500' },
    { node_name: 'Auth System', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'Heartbeat Engine', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'Mail Server', status: 'Active', color: 'bg-emerald-500' },
  ];

  let systemNodes: SystemHealthNode[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('system_status')
      .select('node_name, status, color')
      .order('node_name');
    systemNodes = (data as SystemHealthNode[]) || [];
  } catch (err) {
    console.error('Failed to load system status:', err);
  }

  const nodes = systemNodes && systemNodes.length ? systemNodes : defaultNodes;

  return (
    <div className="bg-white border border-zinc-250 hover:border-primary-500/45 hover:-translate-y-0.5 hover:shadow-sm rounded-xl p-5 relative overflow-hidden transition-all duration-300 ease-out shadow-2xs group">
      <div className="absolute top-0 right-0 p-5 opacity-[0.03] text-navy-900 pointer-events-none transition-transform duration-500 group-hover:scale-110">
        <Zap className="w-20 h-20" />
      </div>
      <h3 className="text-sm font-extrabold tracking-tight mb-1 relative z-10 text-navy-955 font-sans">Operational Health</h3>
      <p className="text-xs text-zinc-450 font-medium mb-4 relative z-10 font-sans">Real-time status across all services.</p>
      
      <div className="space-y-3 relative z-10">
        {nodes.map(node => (
          <div key={node.node_name} className="flex items-center justify-between hover:bg-zinc-50/80 p-1 -mx-1 rounded-md transition-colors duration-200">
            <span className="text-[10px] font-mono font-bold text-zinc-550 uppercase tracking-wider">{node.node_name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-semibold uppercase text-zinc-400">{node.status}</span>
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", node.color, node.color.includes('emerald') && 'animate-pulse')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5. MAIN DASHBOARD PAGE ───
export default async function AdminAppDashboard() {
  const session = await getSession();
  const userName = session?.name || 'Administrator';

  const quickActions = [
    { href: '/admin/approvals', label: 'Review Requests', icon: CheckSquare, desc: 'Leaves & WFH', color: 'text-violet-650', bg: 'bg-violet-500/10 border-violet-500/10' },
    { href: '/admin/employees', label: 'Staff Directory', icon: Users, desc: 'Manage profiles', color: 'text-primary-650', bg: 'bg-primary-500/10 border-primary-500/10' },
    { href: '/admin/attendance', label: 'Live Reports', icon: TrendingUp, desc: 'View analytics', color: 'text-emerald-650', bg: 'bg-emerald-500/10 border-emerald-500/10' },
    { href: '/admin/settings', label: 'Settings', icon: Settings, desc: 'System settings', color: 'text-zinc-650', bg: 'bg-zinc-500/10 border-zinc-500/10' },
  ];

  return (
    <div className="space-y-6 pb-10">
      <DashboardGreeting userName={userName} email={session?.email} />

      {/* Mobile Quick Actions Block */}
      <div className="block md:hidden bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs space-y-3">
        <h3 className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/approvals" className="col-span-2">
            <button className="w-full flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5" />
                <span>Pending Approvals</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/admin/employees">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 active:scale-95 transition-all text-center gap-1.5 shadow-2xs cursor-pointer text-navy-900 font-bold font-sans">
              <Users className="w-5 h-5 text-primary-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Employee Status</span>
            </button>
          </Link>
          <Link href="/admin/attendance">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 active:scale-95 transition-all text-center gap-1.5 shadow-2xs cursor-pointer text-navy-900 font-bold font-sans">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Export Logs</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ─── Operational KPI Grid (Streaming) ─── */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <OperationalKPIGrid />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">Workforce Analytics</h2>
            </div>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Last 7 Days</span>
            </div>
          </div>
          
          {/* ─── Performance Charts Section (Streaming) ─── */}
          <Suspense fallback={<ChartsSkeleton />}>
            <PerformanceChartsSection />
          </Suspense>

          {/* ─── Realtime Activity Feed (Streaming) ─── */}
          <Suspense fallback={<ActivityFeedSkeleton />}>
            <RealtimeActivityFeed />
          </Suspense>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">Rapid Controls</h2>
            </div>
            <div className="grid grid-cols-1 gap-3.5">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="bg-white border border-zinc-250 hover:border-primary-500/45 hover:-translate-y-1 hover:shadow-md rounded-xl p-4 shadow-2xs transition-all duration-300 ease-out group flex items-center gap-4 relative overflow-hidden">
                    {/* Subtle top border accent on hover */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Shimmer on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

                    <div className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105",
                      action.color,
                      action.bg
                    )}>
                      <action.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-navy-955 tracking-tight leading-snug font-sans">{action.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 font-medium font-sans">{action.desc}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-1 group-hover:translate-x-0">
                      <ArrowRight className="w-3.5 h-3.5 text-navy-900" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ─── System Status Section (Streaming) ─── */}
          <Suspense fallback={<SystemStatusSkeleton />}>
            <SystemStatusSection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
