import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Suspense } from 'react';
import DailyReportsClientWrapper from './DailyReportsClientWrapper';
import { DailyReportsSkeleton } from './skeletons';

export const metadata = {
  title: 'Daily Reports Dashboard - PrimeTek Admin',
  description: 'Track and export employee daily recruitment reports.',
};

export default async function AdminDailyReportsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<DailyReportsSkeleton />}>
        <DailyReportsClientWrapper />
      </Suspense>
    </div>
  );
}
