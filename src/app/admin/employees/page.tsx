import { Suspense } from 'react';
import EmployeesClientWrapper from './EmployeesClientWrapper';
import { EmployeesSkeleton } from './skeletons';

export const dynamic = 'force-dynamic';

export default async function AdminAppEmployeesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Staff Directory</h1>
        <p className="text-text-secondary text-sm">Manage employees and their status.</p>
      </div>
      <Suspense fallback={<EmployeesSkeleton />}>
        <EmployeesClientWrapper />
      </Suspense>
    </div>
  );
}
