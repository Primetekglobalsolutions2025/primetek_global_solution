import { getAllDailyReports, getActiveEmployees, getSubmissionStatus } from './actions';
import DailyReportsAdminClient from './DailyReportsAdminClient';

export default async function DailyReportsClientWrapper() {
  // Use local timezone shift to align with workforce shifts, default en-CA today string
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
