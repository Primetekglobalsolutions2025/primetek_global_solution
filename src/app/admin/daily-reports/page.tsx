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
  
  const [initialReports, initialEmployees, initialSubmissionStatus] = await Promise.all([
    getAllDailyReports(todayStr),
    getActiveEmployees(),
    getSubmissionStatus(todayStr)
  ]);

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
