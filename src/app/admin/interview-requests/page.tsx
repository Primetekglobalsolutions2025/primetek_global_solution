import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAllInterviewRequests } from './actions';
import InterviewRequestsClient from './InterviewRequestsClient';

export const dynamic = 'force-dynamic';

export default async function AdminInterviewRequestsPage() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    redirect('/admin/login');
  }

  const requests = await getAllInterviewRequests();

  return (
    <div className="max-w-7xl mx-auto">
      <InterviewRequestsClient initialRequests={requests} />
    </div>
  );
}
