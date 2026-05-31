import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getHolidays } from './actions';
import AdminHolidaysClient from './AdminHolidaysClient';

export const dynamic = 'force-dynamic';

export default async function AdminHolidaysPage() {
  const session = await getSession();
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const isAdmin = session.role === 'admin' || session.role === 'hr';
  if (!isAdmin) {
    redirect('/employee/dashboard');
  }

  const holidaysResult = await getHolidays();
  const initialHolidays = holidaysResult.success ? holidaysResult.holidays : [];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Holiday Management</h1>
        <p className="text-zinc-550 text-sm">Schedule and manage company holidays.</p>
      </div>
      <AdminHolidaysClient initialHolidays={initialHolidays} />
    </div>
  );
}
