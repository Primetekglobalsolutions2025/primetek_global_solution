import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAttendanceSummary, getLeaveSummary, getDailyReportSummary, getSecuritySummary } from './actions';
import ReportsClient from './ReportsClient';

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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-navy-900 tracking-tight">My Reports</h1>
        <p className="text-text-secondary text-sm">Full breakdown of your attendance, leaves, daily work, and security activity.</p>
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
