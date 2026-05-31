import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAdminWFHRequests, getActiveEmployees } from './actions';
import AdminWFHClient from './AdminWFHClient';

export const dynamic = 'force-dynamic';

export default async function AdminWFHPage() {
  const session = await getSession();
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const isAdmin = session.role === 'admin' || session.role === 'hr';
  if (!isAdmin) {
    redirect('/employee/dashboard');
  }

  const [requests, employees] = await Promise.all([
    getAdminWFHRequests(),
    getActiveEmployees()
  ]);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">WFH & Remote Overrides</h1>
        <p className="text-zinc-550 text-sm">Create global WFH company overrides or schedule individual pre-approved WFH periods.</p>
      </div>
      <AdminWFHClient initialRequests={requests} employees={employees} />
    </div>
  );
}
