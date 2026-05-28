import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import PasswordChangeForm from '@/components/profile/PasswordChangeForm';
import Card from '@/components/ui/Card';
import { User, Mail, Shield } from 'lucide-react';

export default async function AdminProfilePage() {
  const session = await getSession();
  
  if (!session || !session.id || session.role !== 'admin') {
    redirect('/admin/login');
  }

  // Admin user data comes from the session/JWT which gets populated by Supabase Auth metadata
  const admin = {
    name: session.name || 'Administrator',
    email: session.email || 'admin@primetek.com',
    role: session.role
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl font-bold text-navy-900 tracking-tight">Admin Profile</h1>
          </div>
          <p className="text-xs text-zinc-450">
            Manage your account and security settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Info */}
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-primary-500/10 text-primary-650 border border-primary-500/20 flex items-center justify-center">
              <User className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-sm font-semibold text-navy-900">Account Details</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Full Name</label>
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-zinc-50 border border-zinc-200/80">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-navy-900">{admin.name}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Email Address</label>
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-zinc-50 border border-zinc-200/80">
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-navy-900">{admin.email}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Role</label>
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary-500/10 border border-primary-500/20">
                <Shield className="w-3.5 h-3.5 text-primary-600" />
                <span className="text-xs font-bold text-primary-750 uppercase tracking-wider">{admin.role}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Password Change */}
        <Card hover={false} className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
          <PasswordChangeForm />
        </Card>
      </div>
    </div>
  );
}
