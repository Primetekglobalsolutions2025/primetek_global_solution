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

  let profiles: any[] = [];
  let employees: any[] = [];

  try {
    profiles = await getAllProfiles() || [];
    employees = await getAllEmployees() || [];
  } catch (err) {
    console.error('Failed to load client profiles from database:', err);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <ClientProfilesClient initialProfiles={profiles} employees={employees} />
    </div>
  );
}
