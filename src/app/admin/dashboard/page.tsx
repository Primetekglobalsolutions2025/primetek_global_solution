import { MessageSquare, Users, Clock, Settings, ArrowRight, CheckSquare, TrendingUp, Zap, FileUser } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatDate, cn } from '@/lib/utils';
import Link from 'next/link';
import AnalyticsCharts from '@/components/admin/AnalyticsCharts';
import DashboardGreeting from '@/components/admin/DashboardGreeting';
import { getSession } from '@/lib/auth';
import { Suspense } from 'react';
import { StatsCardsSkeleton, ChartsSkeleton, RecentInquiriesSkeleton, SystemStatusSkeleton } from './skeletons';

// ─── 1. ASYNC STATS SECTION ───
async function StatsGrid() {
  let inquiriesCount = 0;
  let clientProfilesCount = 0;
  let employeesCount = 0;
  let pendingLeavesCount = 0;
  let pendingWFHCount = 0;

  try {
    const [
      inquiriesRes,
      profilesRes,
      employeesRes,
      pendingLeavesRes,
      pendingWFHRes
    ] = await Promise.all([
      supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('application_profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true }).ilike('status', 'Pending'),
      supabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).ilike('status', 'Pending WFH'),
    ]);

    inquiriesCount = inquiriesRes.count || 0;
    clientProfilesCount = profilesRes.count || 0;
    employeesCount = employeesRes.count || 0;
    pendingLeavesCount = pendingLeavesRes.count || 0;
    pendingWFHCount = pendingWFHRes.count || 0;
  } catch (err) {
    console.error('Failed to load dashboard metrics from database:', err);
  }

  const totalPending = pendingLeavesCount + pendingWFHCount;

  const stats = [
    { label: 'Inquiries', value: inquiriesCount.toString(), icon: MessageSquare, color: 'text-primary-650', bg: 'bg-primary-500/10 border-primary-500/10', href: '/admin/inquiries' },
    { label: 'Client Profiles', value: clientProfilesCount.toString(), icon: FileUser, color: 'text-amber-650', bg: 'bg-amber-500/10 border-amber-500/10', href: '/admin/client-profiles' },
    { label: 'Employees', value: employeesCount.toString(), icon: Users, color: 'text-emerald-650', bg: 'bg-emerald-500/10 border-emerald-500/10', href: '/admin/employees' },
    { label: 'Approvals', value: totalPending.toString(), icon: Clock, color: 'text-violet-650', bg: 'bg-violet-500/10 border-violet-500/10', href: '/admin/approvals' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Link 
          key={stat.label} 
          href={stat.href}
          className="group bg-white rounded-lg p-5 border border-zinc-200/80 flex flex-col gap-4 relative hover:border-primary-500/50 transition-all duration-200 shadow-2xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center transition-transform duration-300 group-hover:scale-105 border',
              stat.color,
              stat.bg
            )}>
              <stat.icon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-navy-900 font-sans leading-none">{stat.value}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mt-2 font-sans">{stat.label}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── 2. ASYNC MOBILE APPROVALS BUTTON ───
async function MobilePendingApprovalsButton() {
  let pendingLeavesCount = 0;
  let pendingWFHCount = 0;

  try {
    const [pendingLeavesRes, pendingWFHRes] = await Promise.all([
      supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true }).ilike('status', 'Pending'),
      supabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).ilike('status', 'Pending WFH'),
    ]);
    pendingLeavesCount = pendingLeavesRes.count || 0;
    pendingWFHCount = pendingWFHRes.count || 0;
  } catch (err) {}

  const totalPending = pendingLeavesCount + pendingWFHCount;

  return (
    <Link href="/admin/approvals" className="col-span-2">
      <button className="w-full flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-5 h-5" />
          <span>Pending Approvals ({totalPending})</span>
        </div>
        <ArrowRight className="w-4 h-4" />
      </button>
    </Link>
  );
}

// ─── 3. ASYNC PERFORMANCE CHARTS SECTION ───
async function PerformanceChartsSection() {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
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

// ─── 4. ASYNC RECENT INQUIRIES SECTION ───
async function RecentInquiriesSection() {
  let recentInquiries: any[] = [];
  
  try {
    const { data } = await supabaseAdmin
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    recentInquiries = data || [];
  } catch (err) {
    console.error('Failed to load recent inquiries:', err);
  }

  const statusColors: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    contacted: 'bg-amber-50 text-amber-700 border-amber-200',
    qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-zinc-100 text-zinc-550 border-zinc-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary-500 rounded-full" />
          <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">Recent Inquiries</h2>
        </div>
        <Link href="/admin/inquiries" className="text-[9px] font-mono font-medium text-primary-700 hover:text-primary-800 uppercase tracking-wider bg-primary-50/50 border border-primary-200/40 px-3 py-1 rounded transition-all">
          View All
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
        <div className="divide-y divide-zinc-100">
          {recentInquiries?.map((inq) => (
            <div key={inq.id} className="px-5 py-3.5 hover:bg-zinc-50/50 transition-all group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-navy-900 group-hover:text-primary-650 transition-colors font-sans">{inq.name}</span>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[8px] font-mono font-medium border uppercase tracking-wider",
                  statusColors[inq.status] || statusColors.new
                )}>
                  {inq.status}
                </span>
              </div>
              <p className="text-xs text-zinc-500 line-clamp-1 mb-1.5 font-medium font-sans">{inq.message}</p>
              <div className="flex items-center gap-3 text-[9px] text-zinc-400 font-mono uppercase tracking-wider">
                {inq.company && <span className="text-zinc-500">{inq.company}</span>}
                {inq.company && <span>•</span>}
                <span>{formatDate(inq.created_at)}</span>
              </div>
            </div>
          ))}
          {(!recentInquiries || recentInquiries.length === 0) && (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider font-mono">No active inquiries</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 5. ASYNC SYSTEM STATUS SECTION ───
async function SystemStatusSection() {
  let systemNodes: any[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('system_status')
      .select('node_name, status, color')
      .order('node_name');
    systemNodes = data || [];
  } catch (err) {
    console.error('Failed to load system status:', err);
  }

  const nodes = systemNodes && systemNodes.length ? systemNodes : [
    { node_name: 'Authentication', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'DB Cluster', status: 'Syncing', color: 'bg-emerald-500' },
    { node_name: 'Mail Server', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'API Gateway', status: 'Optimal', color: 'bg-primary-400' },
  ];

  return (
    <div className="bg-white border border-zinc-200 hover:border-primary-500/50 rounded-lg p-5 relative overflow-hidden transition-all duration-200 shadow-2xs group">
      <div className="absolute top-0 right-0 p-5 opacity-[0.03] text-navy-900 pointer-events-none">
        <Zap className="w-20 h-20" />
      </div>
      <h3 className="text-sm font-bold tracking-tight mb-1 relative z-10 text-navy-900 font-sans">System Status</h3>
      <p className="text-xs text-zinc-450 font-medium mb-4 relative z-10 font-sans">Real-time status check across all services.</p>
      
      <div className="space-y-3 relative z-10">
        {nodes.map(node => (
          <div key={node.node_name} className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-zinc-550 uppercase tracking-wider">{node.node_name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-semibold uppercase text-zinc-400">{node.status}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${node.color} shrink-0`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 6. MAIN DASHBOARD PAGE (Non-blocking Layout shell) ───
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

      {/* Mobile Quick Actions Block (Streaming button inside fallback) */}
      <div className="block md:hidden bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs space-y-3">
        <h3 className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Suspense fallback={
            <div className="col-span-2 h-14 bg-gradient-to-r from-violet-500/10 to-indigo-600/10 border border-violet-500/20 rounded-lg animate-pulse flex items-center justify-between px-4">
              <div className="h-4 w-32 bg-violet-200/50 rounded" />
              <div className="h-4 w-4 bg-violet-200/50 rounded" />
            </div>
          }>
            <MobilePendingApprovalsButton />
          </Suspense>
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

      {/* ─── Stats Cards Section (Streaming) ─── */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsGrid />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <h2 className="text-sm font-semibold text-navy-900 tracking-tight font-sans">Performance Analytics</h2>
            </div>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Last 7 Days</span>
            </div>
          </div>
          
          {/* ─── Performance Charts Section (Streaming) ─── */}
          <Suspense fallback={<ChartsSkeleton />}>
            <PerformanceChartsSection />
          </Suspense>

          {/* ─── Recent Inquiries Section (Streaming) ─── */}
          <Suspense fallback={<RecentInquiriesSkeleton />}>
            <RecentInquiriesSection />
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
                  <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-2xs hover:shadow-sm transition-all duration-200 group flex items-center gap-4 hover:border-primary-500/30">
                    <div className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105",
                      action.color,
                      action.bg
                    )}>
                      <action.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy-900 tracking-tight leading-snug font-sans">{action.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 font-medium font-sans">{action.desc}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0">
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
