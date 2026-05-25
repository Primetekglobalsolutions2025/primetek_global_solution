import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAllProfiles, getAllEmployees } from './actions';
import ClientProfilesClient from './ClientProfilesClient';

export const dynamic = 'force-dynamic';

export default async function AdminClientProfilesPage() {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    redirect('/admin/login');
  }

  const profiles = await getAllProfiles();
  const employees = await getAllEmployees();

  return (
    <div className="max-w-7xl mx-auto">
      <ClientProfilesClient initialProfiles={profiles} employees={employees} />
    </div>
  );
}
