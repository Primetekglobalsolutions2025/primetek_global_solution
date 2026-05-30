import { getEmployeeLeaves, getLeaveBalances } from './actions';
import LeavesClient from './LeavesClient';

export const dynamic = 'force-dynamic';

export default async function LeavesPage() {
  const [leaves, balances] = await Promise.all([
    getEmployeeLeaves(),
    getLeaveBalances()
  ]);

  return <div className="pb-24"><LeavesClient initialLeaves={leaves} initialBalances={balances} /></div>;
}
