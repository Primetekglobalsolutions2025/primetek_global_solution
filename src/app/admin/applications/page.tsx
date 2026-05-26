import { getAdminApplications } from './actions';
import ApplicationsClient from './ApplicationsClient';

export default async function AdminAppApplicationsPage() {
  const applications = await getAdminApplications();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-navy-900 tracking-tight">Candidate Pipeline</h1>
        <p className="text-text-secondary text-sm">Track and manage all candidate applications through the recruitment pipeline.</p>
      </div>
      <ApplicationsClient initialApps={applications || []} />
    </div>
  );
}
