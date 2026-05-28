import { getAdminAttendance, getEmployeesList } from './actions';
import AttendanceClient from './AttendanceClient';

interface AttendanceClientWrapperProps {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export default async function AttendanceClientWrapper({
  startDate,
  endDate,
  page = 1,
  pageSize = 100,
}: AttendanceClientWrapperProps) {
  const [attendance, employees] = await Promise.all([
    getAdminAttendance(startDate, endDate, page, pageSize),
    getEmployeesList(),
  ]);

  return (
    <AttendanceClient
      initialAttendance={attendance?.data || []}
      employees={employees || []}
      totalCount={attendance?.count || 0}
      totalPagesServer={attendance?.totalPages || 1}
      currentPageServer={attendance?.currentPage || 1}
    />
  );
}
