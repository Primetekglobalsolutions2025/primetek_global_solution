import { Suspense } from 'react';
import { getPendingApprovals, getApprovalHistory, getPendingDisputes } from './actions';
import ApprovalsClient from './ApprovalsClient';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function ApprovalsLoader() {
  const [approvalsData, history, disputes] = await Promise.all([
    getPendingApprovals(),
    getApprovalHistory(),
    getPendingDisputes()
  ]);

  return (
    <ApprovalsClient 
      initialLeaves={approvalsData.leaves} 
      initialWFH={approvalsData.wfh} 
      initialWFHRequests={approvalsData.wfhRequests}
      initialHistory={history} 
      initialDisputes={disputes} 
    />
  );
}

function ApprovalsLoadingFallback() {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-zinc-500 gap-2">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Loading approvals queue...</p>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Approvals Hub</h1>
        <p className="text-sm text-text-secondary mt-1">Manage employee leave, WFH, and attendance disputes.</p>
      </div>

      <Suspense fallback={<ApprovalsLoadingFallback />}>
        <ApprovalsLoader />
      </Suspense>
    </div>
  );
}
