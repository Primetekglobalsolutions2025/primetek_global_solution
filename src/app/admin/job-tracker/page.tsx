import JobTrackerClient from './JobTrackerClient';

export const dynamic = 'force-dynamic';

export default async function AdminJobTrackerPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Job Tracker</h1>
        <p className="text-text-secondary text-sm">Track, filter, and audit job applications submitted by employees in real-time.</p>
      </div>
      <JobTrackerClient />
    </div>
  );
}
