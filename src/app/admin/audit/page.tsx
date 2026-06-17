import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { History, User, Clock, ShieldCheck, Search, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';

const formatSafeDateTime = (dateStr: string | number | Date | null | undefined) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata', hour12: true
  });
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
    const sanitizedQ = `%${q.replace(/[()",.]/g, '')}%`;
    let orFilter = `action.ilike."${sanitizedQ}",user_role.ilike."${sanitizedQ}",entity_type.ilike."${sanitizedQ}"`;
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

  // Batch query to resolve user emails and names
  const userIds = Array.from(new Set(logs?.map(log => log.user_id) || [])).filter(Boolean);
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
    <div className="space-y-6 pb-12 font-sans text-zinc-650">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">System Audit Logs</h1>
          </div>
          <p className="text-xs text-zinc-450">
            Immutable record of all critical administrative actions.
          </p>
        </div>

        <form method="GET" action="/admin/audit" className="relative group w-full sm:w-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-450 focus:text-primary-500 transition-colors" />
          <input 
            type="text" 
            name="q"
            defaultValue={q}
            placeholder="Search logs..." 
            className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border border-zinc-200 bg-white text-xs text-navy-900 placeholder:text-zinc-450 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all shadow-sm font-semibold"
          />
        </form>
      </div>
      {/* Mobile view */}
      <div className="block md:hidden space-y-3">
        {(!logs || logs.length === 0) ? (
          <div className="p-8 text-center bg-white rounded-lg border border-zinc-200">
            <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-2 text-zinc-400">
              <History className="w-5 h-5" />
            </div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider font-mono">No logs matching query</p>
          </div>
        ) : (
          logs.map((log) => {
            return (
              <div key={log.id} className="bg-white rounded-lg border border-zinc-200 shadow-2xs p-5 space-y-4 text-zinc-650">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-zinc-350" />
                    <span>{formatSafeDateTime(log.created_at)}</span>
                  </div>
                  <StatusBadge status={log.action} />
                </div>
                <div className="grid grid-cols-2 gap-4 bg-zinc-50/50 p-3 rounded-lg border border-zinc-200/60 text-[10px]">
                  <div>
                    <span className="text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Actor</span>
                    <span className="font-bold text-navy-900">
                      {actorMap[log.user_id]?.name || log.user_role.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Module / Entity</span>
                    <span className="font-bold text-navy-900 uppercase">{log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 8)})` : ''}</span>
                  </div>
                </div>

                {log.entity_type === 'attendance' && log.entity_id && (
                  <div className="mt-2.5 pt-2.5 border-t border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-violet-650" />
                      <span className="text-[8px] font-mono font-semibold text-violet-750 uppercase tracking-wider">
                        Traceable Replay Stream
                      </span>
                    </div>
                    <span className="text-[8px] font-mono font-semibold text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
                      Session: #{log.entity_id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-zinc-650 border-b border-zinc-200">
                <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Event Timeline</th>
                <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Actor</th>
                <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Operation</th>
                <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Module</th>
                <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Entity Context</th>
                <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center">Trace Replay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {logs?.map((log) => {
                const isDelete = log.action.includes('DELETE');
                const isOverride = log.action.includes('OVERRIDE') || log.action.includes('REVERSE') || log.action.includes('CORRECT') || log.action.includes('REBUILD');
                
                return (
                  <tr key={log.id} className={cn(
                    "hover:bg-zinc-50/50 transition-colors group text-zinc-600",
                    isOverride && "bg-violet-50/30 border-l-2 border-l-violet-400",
                    isDelete && "bg-red-50/20 border-l-2 border-l-red-400"
                  )}>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 text-zinc-350" />
                        {formatSafeDateTime(log.created_at)}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-550 group-hover:bg-primary-500/10 group-hover:text-primary-650 group-hover:border-primary-500/20 transition-all">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-navy-900 tracking-tight font-sans">
                            {actorMap[log.user_id]?.name || log.user_role.toUpperCase()}
                          </span>
                          {actorMap[log.user_id]?.email && (
                            <span className="text-[9px] text-zinc-450 lowercase">
                              {actorMap[log.user_id].email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <StatusBadge status={log.action} />
                    </td>
                    <td className="p-4 whitespace-nowrap text-[9px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                      {log.entity_type}
                    </td>
                    <td className="p-4 text-[10px] text-zinc-400 font-semibold font-mono">
                      {log.entity_id ? `${log.entity_id.substring(0, 8)}...` : 'N/A'}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {log.entity_type === 'attendance' && log.entity_id ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-50 text-violet-750 border border-violet-200/50 text-[8px] font-mono font-medium uppercase tracking-wider" title={`Traceable event-sourcing stream: Session ID: ${log.entity_id}`}>
                          <Layers className="w-3 h-3 text-violet-500" />
                          <span>SESSION #{log.entity_id.substring(0, 8).toUpperCase()}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-bold font-mono">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-12 text-center font-sans">
                    <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-3 text-zinc-450">
                      <History className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">No Logs Found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-2xs font-sans">
          <div className="text-xs text-zinc-500 font-semibold uppercase tracking-tighter">
            Showing <span className="font-bold text-navy-900">{offset + 1}</span> to{' '}
            <span className="font-bold text-navy-900">
              {Math.min(offset + limit, totalCount)}
            </span>{' '}
            of <span className="font-bold text-navy-900">{totalCount}</span> entries
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={page > 1 ? `/admin/audit?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}` : '#'}
              className={cn(
                "px-3 py-1.5 rounded border border-zinc-200 text-xs font-semibold transition-all active:scale-95",
                page <= 1
                  ? "pointer-events-none opacity-40 bg-zinc-50 text-zinc-400"
                  : "bg-white text-zinc-655 hover:bg-zinc-50 hover:text-navy-900"
              )}
            >
              Prev
            </Link>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = totalPages <= 7 ? i + 1 : 
                page <= 4 ? i + 1 : 
                page >= totalPages - 3 ? totalPages - 6 + i : 
                page - 3 + i;
              return (
                <Link
                  key={pageNum}
                  href={`/admin/audit?page=${pageNum}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className={cn(
                    "w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all",
                    pageNum === page
                      ? "bg-primary-500 text-white shadow-sm"
                      : "bg-white border border-zinc-200 text-zinc-500 hover:text-navy-900 hover:bg-zinc-50"
                  )}
                >
                  {pageNum}
                </Link>
              );
            })}
            <Link
              href={page < totalPages ? `/admin/audit?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}` : '#'}
              className={cn(
                "px-3 py-1.5 rounded border border-zinc-200 text-xs font-semibold transition-all active:scale-95",
                page >= totalPages
                  ? "pointer-events-none opacity-40 bg-zinc-50 text-zinc-400"
                  : "bg-white text-zinc-655 hover:bg-zinc-50 hover:text-navy-900"
              )}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
