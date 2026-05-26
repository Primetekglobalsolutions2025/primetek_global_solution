import { getAdminAttendance, getEmployeesList } from './actions';
import AttendanceClient from './AttendanceClient';

interface PageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function AdminAppAttendancePage(props: PageProps) {
  const resolvedParams = await props.searchParams;
  const startDate = typeof resolvedParams.startDate === 'string' ? resolvedParams.startDate : undefined;
  const endDate = typeof resolvedParams.endDate === 'string' ? resolvedParams.endDate : undefined;

  const [attendance, employees] = await Promise.all([
    getAdminAttendance(startDate, endDate),
    getEmployeesList()
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-navy-900 tracking-tight">Attendance Reports</h1>
        <p className="text-text-secondary text-sm">Track and review employee attendance.</p>
      </div>
      <AttendanceClient initialAttendance={attendance || []} employees={employees || []} />
    </div>
  );
}
