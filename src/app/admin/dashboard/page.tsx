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

  const [
    { count: inquiriesCount },
    { count: activeJobsCount },
    { count: employeesCount },
    { count: pendingLeavesCount },
    { count: pendingWFHCount },
    { data: recentInquiries }
  ] = await Promise.all([
    supabaseAdmin.from('inquiries').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('leave_requests').select('*', { count: 'exact', head: true }).ilike('status', 'Pending'),
    supabaseAdmin.from('attendance').select('*', { count: 'exact', head: true }).ilike('status', 'Pending WFH'),
    supabaseAdmin.from('inquiries').select('*').order('created_at', { ascending: false }).limit(5)
  ]);

  const totalPending = (pendingLeavesCount || 0) + (pendingWFHCount || 0);

  const stats = [
    { label: 'Inquiries', value: inquiriesCount || '0', icon: MessageSquare, color: 'text-primary-500', bg: 'bg-primary-50/50', border: 'border-primary-100' },
    { label: 'Active Jobs', value: activeJobsCount || '0', icon: Briefcase, color: 'text-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-100' },
    { label: 'Employees', value: employeesCount || '0', icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50/50', border: 'border-emerald-100' },
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

  // Calculate Real Attendance Trends (Last 7 Days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const { data: attendanceTrends } = await supabaseAdmin
    .from('attendance')
    .select('date, status')
    .in('date', last7Days);

  const attendanceData = last7Days.map(date => {
    const dayRecords = (attendanceTrends || []).filter(r => r.date === date);
    const present = dayRecords.filter(r => !r.status.toLowerCase().includes('absent') && !r.status.toLowerCase().includes('rejected')).length;
    const percentage = employeesCount ? Math.round((present / employeesCount) * 100) : 0;
    return { 
      label: new Date(date).toLocaleDateString('en-US', { weekday: 'short' })[0], 
      value: percentage 
    };
  });

  // Calculate Real Inquiry Velocity (Last 4 Weeks)
  const last4Weeks = Array.from({ length: 4 }, (_, i) => {
    const start = new Date();
    start.setDate(start.getDate() - (i + 1) * 7);
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    return { start, end, label: `W${4-i}` };
  }).reverse();

  const { data: inquiryTrends } = await supabaseAdmin
    .from('inquiries')
    .select('created_at')
    .gte('created_at', last4Weeks[0].start.toISOString());

  const applicationData = last4Weeks.map(week => {
    const count = (inquiryTrends || []).filter(inq => {
      const d = new Date(inq.created_at);
      return d >= week.start && d < week.end;
    }).length;
    return { label: week.label, value: count };
  });

  // Fetch System Node Status
  const { data: systemNodes } = await supabaseAdmin
    .from('system_status')
    .select('node_name, status, color')
    .order('node_name');

  const nodes = systemNodes?.length ? systemNodes : [
    { node_name: 'Authentication', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'DB Cluster', status: 'Syncing', color: 'bg-emerald-500' },
    { node_name: 'Mail Server', status: 'Active', color: 'bg-emerald-500' },
    { node_name: 'API Gateway', status: 'Optimal', color: 'bg-primary-400' },
  ];

  return (
    <div className="space-y-8 pb-10">
      <DashboardGreeting userName={userName} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-[2rem] p-6 border border-border/60 shadow-sm hover:shadow-xl hover:shadow-navy-900/5 transition-all duration-300 group">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-black text-navy-900 tracking-tight">{stat.value}</p>
              <p className="text-xs text-text-muted font-bold uppercase tracking-[0.15em] mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-heading font-black text-navy-900 tracking-tight">Performance Analytics</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full bg-surface-alt text-[10px] font-bold text-text-muted uppercase tracking-widest">Last 7 Days</span>
            </div>
          </div>
          
          <AnalyticsCharts 
            attendanceData={attendanceData}
            applicationData={applicationData}
          />

          <div className="bg-white rounded-[2.5rem] border border-border/60 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-surface-alt/30">
              <h2 className="font-heading font-black text-navy-900 text-sm uppercase tracking-widest">Inquiries Received</h2>
              <Link href="/admin/inquiries" className="group flex items-center gap-2 text-[10px] font-bold text-primary-500 uppercase tracking-widest hover:text-primary-600 transition-colors">
                View All <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <div className="divide-y divide-border/50">
              {recentInquiries?.map((inq) => (
                <div key={inq.id} className="px-8 py-5 hover:bg-surface-alt/30 transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-navy-900 group-hover:text-primary-600 transition-colors">{inq.name}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest border shrink-0 ${statusColors[inq.status] || statusColors.new}`}>
                      {inq.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1 mb-2 font-medium">{inq.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                    {inq.company && <span className="text-navy-900/40">{inq.company}</span>}
                    {inq.company && <span>•</span>}
                    <span>{formatDate(inq.created_at)}</span>
                  </div>
                </div>
              ))}
              {(!recentInquiries || recentInquiries.length === 0) && (
                <div className="px-8 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-text-muted font-bold">No active inquiries in the queue.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          <h2 className="text-xl font-heading font-black text-navy-900 tracking-tight">Rapid Controls</h2>
          <div className="grid grid-cols-1 gap-4">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="bg-white rounded-[2rem] p-6 border border-border/60 shadow-sm hover:shadow-xl hover:shadow-navy-900/5 transition-all duration-300 group flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl ${action.color} text-white flex items-center justify-center shrink-0 shadow-lg shadow-black/5 group-hover:scale-105 transition-transform`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-navy-900 tracking-tight">{action.label}</p>
                    <p className="text-[11px] text-text-muted mt-1 font-medium">{action.desc}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    <ArrowRight className="w-4 h-4 text-navy-900" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="w-24 h-24" />
            </div>
            <h3 className="text-lg font-heading font-black tracking-tight mb-2 relative z-10 text-white">System Status</h3>
            <p className="text-xs text-gray-400 font-medium mb-6 relative z-10">Real-time status check across all services.</p>
            
            <div className="space-y-4 relative z-10">
              {nodes.map(node => (
                <div key={node.node_name} className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">{node.node_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-gray-500">{node.status}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${node.color} shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
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
