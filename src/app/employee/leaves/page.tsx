import { getEmployeeLeaves, getLeaveBalances } from './actions';
import { getEmployeeWFHRequests } from '@/app/employee/wfh/actions';
import LeavesClient from './LeavesClient';

export const dynamic = 'force-dynamic';

export default async function LeavesPage() {
  const [leaves, balances, wfhRequests] = await Promise.all([
    getEmployeeLeaves(),
    getLeaveBalances(),
    getEmployeeWFHRequests()
  ]);

  return (
    <div className="pb-24">
      <LeavesClient 
        initialLeaves={leaves} 
        initialBalances={balances} 
        initialWfhRequests={wfhRequests} 
      />
    </div>
  );
}
