import { getAdminEmployees } from './actions';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesClientWrapper() {
  const result = await getAdminEmployees(1, 100, '', 'all');

  return (
    <EmployeesClient 
      initialEmployees={result.data} 
      initialTotalCount={result.count}
      initialStats={result.stats}
      initialDepartments={result.departments}
    />
  );
}
