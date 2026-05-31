import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import PasswordChangeForm from '@/components/profile/PasswordChangeForm';
import AdminProfileForm from '@/components/profile/AdminProfileForm';
import AdminNotificationPreferences from '@/components/profile/AdminNotificationPreferences';
import Card from '@/components/ui/Card';
import { User } from 'lucide-react';

export default async function AdminProfilePage() {
  const session = await getSession();
  
  if (!session || !session.id || session.role !== 'admin') {
    redirect('/admin/login');
  }

  // Admin user data comes from the session/JWT
  const admin = {
    name: session.name || 'Administrator',
    email: session.email || 'admin@primetek.com',
    role: session.role
  };

  // Fetch preferences from DB
  const { data: dbAdmin } = await supabaseAdmin
    .from('admin_users')
    .select('notification_preferences')
    .eq('id', session.id)
    .maybeSingle();

  const preferences = dbAdmin?.notification_preferences || undefined;

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Admin Profile</h1>
          </div>
          <p className="text-xs text-zinc-450">
            Manage your account and security settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-primary-500/10 text-primary-650 border border-primary-500/20 flex items-center justify-center">
              <User className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-sm font-semibold text-navy-900">Account Details</h2>
          </div>

          <AdminProfileForm 
            initialName={admin.name} 
            email={admin.email} 
            role={admin.role} 
          />
        </Card>

        {/* Password Change */}
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
          <PasswordChangeForm />
        </Card>

        {/* Notification Alerts Settings */}
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
          <AdminNotificationPreferences initialPreferences={preferences} />
        </Card>
      </div>
    </div>
  );
}
