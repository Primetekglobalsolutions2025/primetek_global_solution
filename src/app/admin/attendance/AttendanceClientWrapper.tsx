import { getAdminAttendance, getEmployeesList } from './actions';
import AttendanceClient from './AttendanceClient';

interface AttendanceClientWrapperProps {
  startDate?: string;
  endDate?: string;
}

export default async function AttendanceClientWrapper({
  startDate,
  endDate,
}: AttendanceClientWrapperProps) {
  const [attendance, employees] = await Promise.all([
    getAdminAttendance(startDate, endDate),
    getEmployeesList(),
  ]);

  return (
    <AttendanceClient
      initialAttendance={attendance || []}
      employees={employees || []}
    />
  );
}
