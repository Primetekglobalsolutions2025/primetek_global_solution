import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Card from '@/components/ui/Card';
import { History, User, Activity, Clock, ShieldCheck, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function AuditLogsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/admin/login');

  const { data: logs, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4 pb-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-xl bg-navy-900 p-6 text-white shadow-md shadow-navy-900/10">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[100%] bg-primary-500/10 rounded-full blur-[80px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-primary-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary-200">Security Ledger</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">System Audit Logs</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium">Immutable record of all critical administrative actions.</p>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-full md:w-64"
            />
          </div>
        </div>
      </div>

      <Card hover={false} className="overflow-hidden border-border/60 shadow-sm rounded-xl p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-alt/50 border-b border-border">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Event Timeline</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Actor</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Operation</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Module</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Entity Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-surface-alt/30 transition-colors group">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-secondary">
                      <Clock className="w-3.5 h-3.5 text-primary-500/50" />
                      {new Date(log.created_at).toLocaleString('en-IN', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-surface-alt flex items-center justify-center text-navy-900 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-navy-900 tracking-tight">{log.user_role.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border ${
                       log.action.includes('DELETE') ? 'bg-red-50 text-red-600 border-red-100' :
                       log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                       'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-text-muted font-medium font-mono">
                    {log.entity_id ? `${log.entity_id.substring(0, 8)}...` : 'N/A'}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-3">
                      <History className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs text-text-muted font-bold">The ledger is currently empty.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
