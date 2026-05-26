import { getPendingApprovals, getApprovalHistory } from './actions';
import ApprovalsClient from './ApprovalsClient';

export default async function ApprovalsPage() {
  const [{ leaves, wfh }, history] = await Promise.all([
    getPendingApprovals(),
    getApprovalHistory(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-navy-900">Approvals Hub</h1>
        <p className="text-sm text-text-secondary mt-1">Manage employee leave and WFH requests.</p>
      </div>

      <ApprovalsClient initialLeaves={leaves} initialWFH={wfh} initialHistory={history} />
    </div>
  );
}
