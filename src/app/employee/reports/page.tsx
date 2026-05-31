import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAttendanceSummary, getLeaveSummary, getDailyReportSummary, getSecuritySummary } from './actions';
import ReportsClient from './ReportsClient';
import { typography } from '@/styles/design-system';

export default async function EmployeeReportsPage() {
  const session = await getSession();
  if (!session || !session.id) redirect('/employee/login');

  const [attendance, leaves, dailyReports, security] = await Promise.all([
    getAttendanceSummary().catch(() => null),
    getLeaveSummary().catch(() => null),
    getDailyReportSummary().catch(() => null),
    getSecuritySummary().catch(() => null),
  ]);

  return (
    <div className="space-y-5 pt-4 md:pt-0 pb-24">
      <div>
        <h1 className={typography.pageTitle}>My Reports</h1>
        <p className="text-zinc-500 text-sm">Full breakdown of your attendance, leaves, daily work, and security activity.</p>
      </div>
      <ReportsClient
        attendance={attendance}
        leaves={leaves}
        dailyReports={dailyReports}
        security={security}
      />
    </div>
  );
}
