import { getAdminEmployees } from './actions';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesClientWrapper() {
  const employees = await getAdminEmployees();

  return <EmployeesClient initialEmployees={employees || []} />;
}
