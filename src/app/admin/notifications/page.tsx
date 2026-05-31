import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSentNotifications } from './actions';
import AdminNotificationsClient from './AdminNotificationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const isAdmin = session.role === 'admin' || session.role === 'hr';
  if (!isAdmin) {
    redirect('/employee/dashboard');
  }

  // Fetch employees list and sent history in parallel
  const [
    employeesRes,
    notificationsRes
  ] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, name, employee_id')
      .order('name', { ascending: true }),
    getSentNotifications()
  ]);

  const employees = employeesRes.data || [];
  const initialNotifications = notificationsRes.success ? notificationsRes.notifications : [];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Notification Dispatcher</h1>
        <p className="text-zinc-550 text-sm">Send announcements or targeted alerts to employees.</p>
      </div>
      <AdminNotificationsClient
        employees={employees}
        initialNotifications={initialNotifications}
      />
    </div>
  );
}
