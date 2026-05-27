import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

export default async function EmployeeAppProfilePage() {
  const session = await getSession();
  
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const { data: employee, error } = await supabaseAdmin
    .from('employees')
    .select('id, employee_id, name, email, phone, department, designation, status, join_date, avatar_url, created_at, mfa_enabled')
    .eq('id', session.id)
    .single();

  if (error || !employee) {
    console.error('Error fetching profile:', error);
    redirect('/employee/dashboard');
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-sans font-bold text-navy-900 tracking-tight">My Profile</h1>
        <p className="text-zinc-500 text-sm">View and update your personal information.</p>
      </div>
      <ProfileClient employee={employee} />
    </div>
  );
}
