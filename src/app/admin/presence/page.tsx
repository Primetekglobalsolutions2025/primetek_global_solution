import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import PresenceMonitor from '@/components/admin/PresenceMonitor';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Real-Time Employee Presence Monitor - Primetek HR',
  description: 'Monitor active, idle, break and offline statuses of employees in real-time.',
};

export default async function AdminPresencePage() {
  const session = await getSession();
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const isAdmin = session.role === 'admin' || session.role === 'hr';
  if (!isAdmin) {
    redirect('/employee/dashboard');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('admin-auth-token')?.value || cookieStore.get('employee-auth-token')?.value || '';

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900 font-heading">
          Real-Time Presence Monitor
        </h1>
        <p className="text-zinc-550 text-sm">
          Track employee active session presence, idle states, and break durations.
        </p>
      </div>
      <PresenceMonitor token={token} />
    </div>
  );
}
