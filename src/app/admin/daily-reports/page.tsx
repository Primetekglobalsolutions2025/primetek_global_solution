import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAllDailyReports, getActiveEmployees, getSubmissionStatus } from './actions';
import DailyReportsAdminClient from './DailyReportsAdminClient';

export const metadata = {
  title: 'Daily Reports Dashboard - PrimeTek Admin',
  description: 'Track and export employee daily recruitment reports.',
};

export default async function AdminDailyReportsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/login');
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  let initialReports: any[] = [];
  let initialEmployees: any[] = [];
  let initialSubmissionStatus: any[] = [];

  try {
    const [reports, employees, status] = await Promise.all([
      getAllDailyReports(todayStr),
      getActiveEmployees(),
      getSubmissionStatus(todayStr)
    ]);
    initialReports = reports || [];
    initialEmployees = employees || [];
    initialSubmissionStatus = status || [];
  } catch (err) {
    console.error('Failed to load daily reports data from database:', err);
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <DailyReportsAdminClient
        initialDate={todayStr}
        initialReports={initialReports as any}
        initialEmployees={initialEmployees}
        initialSubmissionStatus={initialSubmissionStatus}
      />
    </div>
  );
}
