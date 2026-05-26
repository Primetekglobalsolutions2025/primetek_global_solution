import { Suspense } from 'react';
import EmployeeDashboardServerWrapper from './EmployeeDashboardServerWrapper';
import { EmployeeDashboardSkeleton } from './skeletons';

export const dynamic = 'force-dynamic';

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<EmployeeDashboardSkeleton />}>
      <EmployeeDashboardServerWrapper />
    </Suspense>
  );
}
