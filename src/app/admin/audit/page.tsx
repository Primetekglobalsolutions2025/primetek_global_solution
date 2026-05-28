import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Card from '@/components/ui/Card';
import { History, User, Clock, ShieldCheck, Search, Activity, LogIn, LogOut, Home, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatSafeDateTime = (dateStr: any) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
  });
};

const formatSafeTimeOnly = (dateStr: any) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AuditLogsPage(props: PageProps) {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/admin/login');

  const resolvedParams = await props.searchParams;
  const q = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';
  const pageStr = typeof resolvedParams.page === 'string' ? resolvedParams.page : '1';
  const page = parseInt(pageStr, 10) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  // Search by user name or email if search query is provided
  const searchUserIds: string[] = [];
  if (q) {
    const [{ data: matchingAdmins }, { data: matchingEmployees }] = await Promise.all([
      supabaseAdmin.from('admin_users').select('id').ilike('email', `%${q}%`),
      supabaseAdmin.from('employees').select('id').or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    ]);

    if (matchingAdmins) {
      searchUserIds.push(...matchingAdmins.map(a => a.id));
    }
    if (matchingEmployees) {
      searchUserIds.push(...matchingEmployees.map(e => e.id));
    }
  }

  let queryBuilder = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' });

  if (q) {
    let orFilter = `action.ilike.%${q}%,user_role.ilike.%${q}%,entity_type.ilike.%${q}%`;
    if (searchUserIds.length > 0) {
      orFilter += `,user_id.in.(${searchUserIds.join(',')})`;
    }
    queryBuilder = queryBuilder.or(orFilter);
  }

  const { data: logs, count, error } = await queryBuilder
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching audit logs:', error);
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Fetch recent activity (last 24h attendance events)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let recentActivity: any[] | null = null;
  try {
    const { data } = await supabaseAdmin
      .from('attendance')
      .select('id, employee_id, date, check_in, check_out, status')
      .gte('date', yesterday)
      .order('date', { ascending: false })
      .limit(15);
    recentActivity = data;
  } catch (e) {
    console.error('Error fetching recent activity:', e);
  }

  // Batch query to resolve user emails and names
  const activityEmpIds = Array.from(new Set(recentActivity?.map(a => a.employee_id) || [])).filter(Boolean);
  const userIds = Array.from(new Set([
    ...(logs?.map(log => log.user_id) || []),
    ...activityEmpIds,
  ])).filter(Boolean);
  const [{ data: admins }, { data: emps }] = await Promise.all([
    supabaseAdmin.from('admin_users').select('id, email').in('id', userIds.length ? userIds : ['_']),
    supabaseAdmin.from('employees').select('id, name, email').in('id', userIds.length ? userIds : ['_'])
  ]);

  const actorMap: Record<string, { name: string; email: string }> = {};
  admins?.forEach(admin => {
    actorMap[admin.id] = { name: 'Admin', email: admin.email };
  });
  emps?.forEach(emp => {
    actorMap[emp.id] = { name: emp.name, email: emp.email };
  });

  return (
    <div className="space-y-6 pb-8 text-zinc-600">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-xl bg-zinc-50 border border-zinc-200 p-6 text-white shadow-md">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-primary-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary-200">Security Ledger</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">System Audit Logs</h1>
            <p className="text-zinc-500 text-xs mt-1 font-medium">Immutable record of all critical administrative actions.</p>
          </div>
          <form method="GET" action="/admin/audit" className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-400 transition-colors" />
            <input 
              type="text" 
              name="q"
              defaultValue={q}
              placeholder="Search logs..." 
              className="pl-9 pr-3 py-2 rounded-lg bg-white border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/30 w-full md:w-64 text-navy-900 placeholder:text-zinc-400"
            />
          </form>
        </div>
      </div>

      {/* Activity Monitoring Section */}
      <div id="activity" className="scroll-mt-20">
        <Card hover={false} className="overflow-hidden border border-zinc-200 shadow-sm rounded-xl p-0 bg-white">
          <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50/50 border-b border-zinc-200/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                <Activity className="w-4 h-4 text-primary-455" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-navy-900 tracking-tight">Activity Monitoring</h2>
                <p className="text-[10px] text-zinc-500 font-medium">Last 24 hours — employee check-ins, check-outs &amp; remote work</p>
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 bg-white px-2.5 py-1 rounded-full border border-zinc-200">
              {recentActivity?.length || 0} events
            </span>
          </div>
          {(!recentActivity || recentActivity.length === 0) ? (
            <div className="p-10 text-center">
              <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center mx-auto mb-2">
                <Activity className="w-5 h-5 text-slate-650" />
              </div>
              <p className="text-xs text-zinc-500 font-bold">No activity in the last 24 hours.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100/40 max-h-[320px] overflow-y-auto">
              {recentActivity.map((act) => {
                const name = actorMap[act.employee_id]?.name || 'Unknown';
                const isWFH = act.status?.includes('WFH');
                const hasCheckOut = !!act.check_out;
                const isPending = act.status === 'Pending WFH';
                const Icon = isWFH ? Home : hasCheckOut ? LogOut : LogIn;
                const iconColor = isWFH ? 'text-violet-400' : hasCheckOut ? 'text-amber-450' : 'text-emerald-450';
                const iconBg = isWFH ? 'bg-violet-500/10' : hasCheckOut ? 'bg-amber-500/10' : 'bg-emerald-500/10';
                const label = isWFH
                  ? (isPending ? 'WFH Request (Pending)' : `WFH ${act.status?.replace(' WFH', '')}`)
                  : hasCheckOut ? 'Checked Out' : 'Checked In';
                const time = formatSafeTimeOnly(act.check_in);
                return (
                  <div key={act.id} className="flex items-center gap-3.5 px-5 py-3 hover:bg-white/20 transition-colors">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-zinc-200/30', iconBg)}>
                      <Icon className={cn('w-4 h-4', iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy-900 truncate">{name}</p>
                      <p className="text-[10px] text-zinc-500 font-medium">
                        {label}{time ? ` · ${time}` : ''} · {act.date}
                      </p>
                    </div>
                    {isPending && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Mobile view */}
      <div className="block md:hidden space-y-3">
        {(!logs || logs.length === 0) ? (
          <div className="p-8 text-center bg-white rounded-xl border border-zinc-200">
            <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center mx-auto mb-2">
              <History className="w-5 h-5 text-slate-650" />
            </div>
            <p className="text-xs text-zinc-500 font-semibold">No audit logs matching query.</p>
          </div>
        ) : (
          logs.map((log) => {
            const isDelete = log.action.includes('DELETE');
            const isCreate = log.action.includes('CREATE') || log.action.includes('ONBOARD');
            const isOverride = log.action.includes('OVERRIDE') || log.action.includes('REVERSE') || log.action.includes('CORRECT') || log.action.includes('REBUILD');
            
            return (
              <Card key={log.id} hover={false} className="p-4 rounded-xl border border-zinc-200 shadow-sm bg-white text-zinc-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
                    <Clock className="w-3.5 h-3.5 text-primary-500/50" />
                    <span>{formatSafeDateTime(log.created_at)}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border uppercase ${
                     isDelete ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                     isCreate ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' :
                     isOverride ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                     'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {log.action}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-zinc-50/40 border border-zinc-200 p-2.5 rounded-lg text-[10px]">
                  <div>
                    <span className="text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Actor</span>
                    <span className="font-bold text-navy-900">
                      {actorMap[log.user_id]?.name || log.user_role.toUpperCase()}
                    </span>
                    {actorMap[log.user_id]?.email && (
                      <span className="text-zinc-500 block text-[9px] lowercase truncate">
                        {actorMap[log.user_id].email}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Module / Entity</span>
                    <span className="font-bold text-navy-900 uppercase">{log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 8)})` : ''}</span>
                  </div>
                </div>

                {/* Grouping visualization for session replays / details */}
                {log.entity_type === 'attendance' && log.entity_id && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200/40 flex items-center gap-1.5 justify-between">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[9px] font-black text-violet-300 font-mono uppercase">
                        Traceable Replay Stream
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-zinc-500 font-mono bg-white border border-zinc-200 px-1.5 py-0.5 rounded">
                      Session: #{log.entity_id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop view */}
      <Card hover={false} className="overflow-hidden border border-zinc-200 shadow-sm rounded-xl p-0 hidden md:block bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200/60">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Event Timeline</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Actor</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Operation</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Module</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Entity Context</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Trace Replay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/60">
              {logs?.map((log) => {
                const isDelete = log.action.includes('DELETE');
                const isCreate = log.action.includes('CREATE') || log.action.includes('ONBOARD');
                const isOverride = log.action.includes('OVERRIDE') || log.action.includes('REVERSE') || log.action.includes('CORRECT') || log.action.includes('REBUILD');
                
                return (
                  <tr key={log.id} className="hover:bg-zinc-50/30 transition-colors group text-zinc-600">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
                        <Clock className="w-3.5 h-3.5 text-primary-500/50" />
                        {formatSafeDateTime(log.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 group-hover:bg-primary-500 group-hover:text-navy-900 transition-colors">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-navy-900 tracking-tight">
                            {actorMap[log.user_id]?.name || log.user_role.toUpperCase()}
                          </span>
                          {actorMap[log.user_id]?.email && (
                            <span className="text-[9px] text-zinc-500">
                              {actorMap[log.user_id].email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border uppercase ${
                         isDelete ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                         isCreate ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' :
                         isOverride ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                         'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      {log.entity_type}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-zinc-400 font-medium font-mono">
                      {log.entity_id ? `${log.entity_id.substring(0, 8)}...` : 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {log.entity_type === 'attendance' && log.entity_id ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-500/5 text-violet-400 border border-violet-500/15 text-[9px] font-black font-mono tracking-tight" title={`Traceable event-sourcing stream: Session ID: ${log.entity_id}`}>
                          <Layers className="w-3 h-3 text-violet-400" />
                          <span>SESSION #{log.entity_id.substring(0, 8).toUpperCase()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-650 font-bold font-mono">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center mx-auto mb-3">
                      <History className="w-5 h-5 text-zinc-450" />
                    </div>
                    <p className="text-xs text-zinc-500 font-bold">No audit logs matching query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 rounded-xl shadow-sm">
          <div className="text-xs text-zinc-500">
            Showing <span className="font-semibold text-navy-900">{offset + 1}</span> to{' '}
            <span className="font-semibold text-navy-900">
              {Math.min(offset + limit, totalCount)}
            </span>{' '}
            of <span className="font-semibold text-navy-900">{totalCount}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <a
              href={page > 1 ? `/admin/audit?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}` : '#'}
              className={cn(
                "px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold transition-all",
                page <= 1
                  ? "pointer-events-none opacity-40 bg-zinc-50 text-zinc-400"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 hover:text-navy-950 active:scale-95"
              )}
            >
              Previous
            </a>
            <span className="text-xs font-semibold text-navy-900 px-2 font-mono">
              Page {page} of {totalPages}
            </span>
            <a
              href={page < totalPages ? `/admin/audit?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}` : '#'}
              className={cn(
                "px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold transition-all",
                page >= totalPages
                  ? "pointer-events-none opacity-40 bg-zinc-50 text-zinc-400"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 hover:text-navy-950 active:scale-95"
              )}
            >
              Next
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
