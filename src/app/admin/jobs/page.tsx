import { getAdminJobs } from './actions';
import JobsClient from './JobsClient';

export default async function AdminAppJobsPage() {
  const jobs = await getAdminJobs();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-navy-900 tracking-tight">Job Listings</h1>
        <p className="text-text-secondary text-sm">Manage active and inactive job postings.</p>
      </div>
      <JobsClient initialJobs={jobs || []} />
    </div>
  );
}
