import { MessageSquare, Users, Clock, Briefcase, Settings, ArrowRight, CheckSquare, TrendingUp, Zap } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import AnalyticsCharts from '@/components/admin/AnalyticsCharts';
import DashboardGreeting from '@/components/admin/DashboardGreeting';
import { getSession } from '@/lib/auth';

export default async function AdminAppDashboard() {
  const session = await getSession();
  const userName = session?.name || 'Administrator';

  let inquiriesCount = 0;
  let activeJobsCount = 0;
  let employeesCount = 0;
  let pendingLeavesCount = 0;
  let pendingWFHCount = 0;
  let recentInquiries: any[] = [];
  let attendanceTrends: any[] = [];
  let inquiryTrends: any[] = [];
  let systemNodes: any[] = [];

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

  try {
    const [
      inquiriesRes,
      activeJobsRes,
      employeesRes,
      pendingLeavesRes,
      pendingWFHRes,
      recentInquiriesRes,
      attendanceTrendsRes,
      inquiryTrendsRes,
      systemNodesRes
    ] = await Promise.all([
      supabaseAdmin.from('inquiries').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leave_requests').select('*', { count: 'exact', head: true }).ilike('status', 'Pending'),
      supabaseAdmin.from('attendance').select('*', { count: 'exact', head: true }).ilike('status', 'Pending WFH'),
      supabaseAdmin.from('inquiries').select('*').order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('attendance').select('date, status').in('date', last7Days),
      supabaseAdmin.from('inquiries').select('created_at').gte('created_at', last4Weeks[0].start.toISOString()),
      supabaseAdmin.from('system_status').select('node_name, status, color').order('node_name')
    ]);

    inquiriesCount = inquiriesRes.count || 0;
    activeJobsCount = activeJobsRes.count || 0;
    employeesCount = employeesRes.count || 0;
    pendingLeavesCount = pendingLeavesRes.count || 0;
    pendingWFHCount = pendingWFHRes.count || 0;
    recentInquiries = recentInquiriesRes.data || [];
    attendanceTrends = attendanceTrendsRes.data || [];
    inquiryTrends = inquiryTrendsRes.data || [];
    systemNodes = systemNodesRes.data || [];
  } catch (err) {
    console.error('Failed to load dashboard metrics from database:', err);
  }

  const totalPending = (pendingLeavesCount || 0) + (pendingWFHCount || 0);

  const stats = [
    { label: 'Inquiries', value: inquiriesCount.toString(), icon: MessageSquare, color: 'text-primary-500', bg: 'bg-primary-50/50', border: 'border-primary-100' },
    { label: 'Active Jobs', value: activeJobsCount.toString(), icon: Briefcase, color: 'text-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-100' },
    { label: 'Employees', value: employeesCount.toString(), icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50/50', border: 'border-emerald-100' },
    { label: 'Approvals', value: totalPending.toString(), icon: Clock, color: 'text-violet-500', bg: 'bg-violet-50/50', border: 'border-violet-100' },
  ];

  const quickActions = [
    { href: '/admin/approvals', label: 'Review Requests', icon: CheckSquare, desc: 'Leaves & WFH', color: 'bg-violet-500' },
    { href: '/admin/employees', label: 'Staff Directory', icon: Users, desc: 'Manage profiles', color: 'bg-primary-500' },
    { href: '/admin/attendance', label: 'Live Reports', icon: TrendingUp, desc: 'View analytics', color: 'bg-emerald-500' },
    { href: '/admin/settings', label: 'Settings', icon: Settings, desc: 'System settings', color: 'bg-navy-900' },
  ];

  const statusColors: Record<string, string> = {
    new: 'bg-blue-50 text-blue-600 border-blue-200',
    contacted: 'bg-amber-50 text-amber-600 border-amber-200',
    qualified: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    closed: 'bg-gray-100 text-gray-500 border-gray-200',
  };

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

  const nodes = systemNodes && systemNodes.length ? systemNodes : [
    { node_name: 'Authentication', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'DB Cluster', status: 'Syncing', color: 'bg-emerald-500' },
    { node_name: 'Mail Server', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'API Gateway', status: 'Optimal', color: 'bg-primary-400' },
  ];

  return (
    <div className="space-y-6 pb-10">
      <DashboardGreeting userName={userName} />

      {/* Mobile Quick Actions Block */}
      <div className="block md:hidden bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-border/50 shadow-sm space-y-3">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/approvals" className="col-span-2">
            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5" />
                <span>Pending Approvals ({totalPending})</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/admin/employees">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-border/60 hover:bg-surface-alt active:scale-95 transition-all text-center gap-1.5 shadow-sm cursor-pointer">
              <Users className="w-5 h-5 text-primary-500" />
              <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">Employee Status</span>
            </button>
          </Link>
          <Link href="/admin/attendance">
            <button className="w-full flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-border/60 hover:bg-surface-alt active:scale-95 transition-all text-center gap-1.5 shadow-sm cursor-pointer">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">Export Logs</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 md:p-5 border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 group">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight leading-none">{stat.value}</p>
              <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mt-1.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900 tracking-tight">Performance Analytics</h2>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-alt text-[9px] font-semibold text-text-muted uppercase tracking-widest">Last 7 Days</span>
            </div>
          </div>
          
          <AnalyticsCharts 
            attendanceData={attendanceData}
            applicationData={applicationData}
          />

          <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between bg-surface-alt/30">
              <h2 className="font-semibold text-navy-900 text-xs uppercase tracking-wider">Inquiries Received</h2>
              <Link href="/admin/inquiries" className="group flex items-center gap-1.5 text-[10px] font-semibold text-primary-500 uppercase tracking-wider hover:text-primary-600 transition-colors">
                View All <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="divide-y divide-border/50">
              {recentInquiries?.map((inq) => (
                <div key={inq.id} className="px-5 py-3.5 hover:bg-surface-alt/30 transition-all group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-navy-900 group-hover:text-primary-600 transition-colors">{inq.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider border shrink-0 ${statusColors[inq.status] || statusColors.new}`}>
                      {inq.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1 mb-1.5 font-medium">{inq.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted font-semibold uppercase tracking-tighter">
                    {inq.company && <span className="text-navy-900/40">{inq.company}</span>}
                    {inq.company && <span>•</span>}
                    <span>{formatDate(inq.created_at)}</span>
                  </div>
                </div>
              ))}
              {(!recentInquiries || recentInquiries.length === 0) && (
                <div className="px-5 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-xs text-text-muted font-semibold">No active inquiries in the queue.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-navy-900 tracking-tight mb-4">Rapid Controls</h2>
            <div className="grid grid-cols-1 gap-3.5">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="bg-white rounded-xl p-4 border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 group flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg ${action.color} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                      <action.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900 tracking-tight leading-snug">{action.label}</p>
                      <p className="text-[11px] text-text-muted mt-0.5 font-medium">{action.desc}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-surface-alt flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0">
                      <ArrowRight className="w-3.5 h-3.5 text-navy-900" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-navy-900 rounded-xl p-6 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Zap className="w-20 h-20" />
            </div>
            <h3 className="text-base font-semibold tracking-tight mb-1 relative z-10 text-white">System Status</h3>
            <p className="text-xs text-gray-400 font-medium mb-4 relative z-10">Real-time status check across all services.</p>
            
            <div className="space-y-3 relative z-10">
              {nodes.map(node => (
                <div key={node.node_name} className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">{node.node_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase text-gray-500">{node.status}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${node.color} shadow-[0_0_8px_rgba(16,185,129,0.3)]`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
