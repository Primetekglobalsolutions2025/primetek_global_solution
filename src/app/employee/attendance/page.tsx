import { Suspense } from 'react';
import EmployeeAttendanceServerWrapper from './EmployeeAttendanceServerWrapper';
import { EmployeeAttendanceSkeleton } from './skeletons';

export const dynamic = 'force-dynamic';

export default function EmployeeAttendancePage() {
  return (
    <Suspense fallback={<EmployeeAttendanceSkeleton />}>
      <EmployeeAttendanceServerWrapper />
    </Suspense>
  );
}
