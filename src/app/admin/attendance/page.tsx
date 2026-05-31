import { Suspense } from 'react';
import AttendanceClientWrapper from './AttendanceClientWrapper';
import { AttendanceSkeleton } from './skeletons';
import { getISTShiftDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string; page?: string; pageSize?: string }>;
}

export default async function AdminAppAttendancePage(props: PageProps) {
  const resolvedParams = await props.searchParams;
  const today = getISTShiftDate();
  const startDate = typeof resolvedParams.startDate === 'string' ? resolvedParams.startDate : today;
  const endDate = typeof resolvedParams.endDate === 'string' ? resolvedParams.endDate : today;
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) : 1;
  const pageSize = typeof resolvedParams.pageSize === 'string' ? parseInt(resolvedParams.pageSize, 10) : 100;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Attendance Reports</h1>
        <p className="text-text-secondary text-sm">Track and review employee attendance.</p>
      </div>
      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceClientWrapper startDate={startDate} endDate={endDate} page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}

