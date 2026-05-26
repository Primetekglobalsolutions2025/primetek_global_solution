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
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Suspense fallback={<DailyReportsSkeleton />}>
        <DailyReportsClientWrapper />
      </Suspense>
    </div>
  );
}
