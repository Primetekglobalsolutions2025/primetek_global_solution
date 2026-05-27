import { getPendingApprovals, getApprovalHistory, getPendingDisputes } from './actions';
import ApprovalsClient from './ApprovalsClient';

export default async function ApprovalsPage() {
  const [{ leaves, wfh }, history, disputes] = await Promise.all([
    getPendingApprovals(),
    getApprovalHistory(),
    getPendingDisputes()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-navy-900">Approvals Hub</h1>
        <p className="text-sm text-text-secondary mt-1">Manage employee leave, WFH, and attendance disputes.</p>
      </div>

      <ApprovalsClient 
        initialLeaves={leaves} 
        initialWFH={wfh} 
        initialHistory={history} 
        initialDisputes={disputes} 
      />
    </div>
  );
}
