import { getAllDailyReports, getActiveEmployees, getSubmissionStatus } from './actions';
import DailyReportsAdminClient from './DailyReportsAdminClient';
import { getISTShiftDate } from '@/lib/utils';

export default async function DailyReportsClientWrapper() {
  // Use local timezone shift to align with workforce shifts
  const todayStr = getISTShiftDate();

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
    console.error('Failed to load daily reports data from database inside wrapper:', err);
  }

  return (
    <DailyReportsAdminClient
      initialDate={todayStr}
      initialReports={initialReports}
      initialEmployees={initialEmployees}
      initialSubmissionStatus={initialSubmissionStatus}
    />
  );
}
