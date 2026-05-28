import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSettingsClient from './AdminSettingsClient';

export default async function AdminSettingsServerWrapper() {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    redirect('/admin/login');
  }

  return <AdminSettingsClient />;
}
