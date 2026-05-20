'use client';

import { useState, useRef } from 'react';
import { Save, Loader2, CheckCircle2, Camera, Briefcase } from 'lucide-react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PasswordChangeForm from '@/components/profile/PasswordChangeForm';
import MFASetup from '@/components/profile/MFASetup';
import { useRouter } from 'next/navigation';
import { updateProfile, updateAvatar } from './actions';
import { useToast } from '@/components/ui/Toast';

export interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  avatar_url?: string;
  created_at?: string;
  mfa_enabled?: boolean;
  employee_id?: string;
}

export default function ProfileClient({ employee }: { employee: EmployeeProfile }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: employee.name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    department: employee.department || '',
    designation: employee.designation || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(employee.avatar_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateProfile(form.name, form.phone);
      if (res.success) {
        setSaved(true);
        toast.success('Profile details saved successfully.');
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile details.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be under 2MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image (PNG, JPG, etc).');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const res = await updateAvatar(formData);
      if (res.success) {
        setCurrentAvatarUrl(res.avatarUrl);
        toast.success('Avatar uploaded successfully!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const inputClasses = 'w-full px-4 py-3 rounded-lg border border-border bg-white text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm';

  return (
    <div className="space-y-8 pb-12">
      {/* Premium Header */}
      <div className="relative rounded-[2.5rem] bg-navy-900 p-8 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          {/* Avatar Section */}
          <div 
            className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-4xl font-black relative group cursor-pointer overflow-hidden ring-4 ring-white/10 shadow-2xl shadow-primary-500/20"
            onClick={() => fileInputRef.current?.click()}
          >
            {currentAvatarUrl ? (
              <Image src={currentAvatarUrl} alt={employee.name} fill className="object-cover" sizes="128px" priority />
            ) : (
              employee.name ? employee.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'
            )}
            
            <div className="absolute inset-0 bg-navy-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
              {avatarUploading ? <Loader2 className="w-8 h-8 animate-spin text-white" /> : <Camera className="w-8 h-8 text-white" />}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>

          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 mb-3">
              <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Employee</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-black text-white mb-2 tracking-tight">
              {employee.name}
            </h1>
            <p className="text-primary-200/70 text-sm md:text-base font-medium flex items-center justify-center md:justify-start gap-2">
              {employee.designation || 'Team Member'} 
              <span className="w-1 h-1 rounded-full bg-white/20" /> 
              {employee.department || 'Primetek'}
            </p>
          </div>

          <div className="md:ml-auto flex items-center gap-4">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-[100px]">
              <p className="text-[9px] text-primary-300 uppercase font-black tracking-widest mb-1">Employee ID</p>
              <p className="text-sm font-mono font-bold text-white uppercase tracking-tighter">
                {employee.employee_id || 'Active'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Forms Side */}
        <div className="lg:col-span-2 space-y-8">
          <Card hover={false} className="p-8 rounded-[2rem] border-border/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] -mr-4 -mt-4">
              <Save className="w-32 h-32 text-navy-900" />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-heading font-black text-navy-900">Personal Information</h2>
                  <p className="text-xs text-text-muted mt-1 font-medium">Update your contact details and preferences.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="rounded-xl shadow-lg shadow-primary-500/20 px-6">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-navy-900/40 uppercase tracking-widest ml-1">Display Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClasses} placeholder="Your full name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-navy-900/40 uppercase tracking-widest ml-1">Email Address</label>
                  <input type="email" value={form.email} disabled className={`${inputClasses} bg-surface-alt/50 text-text-muted cursor-not-allowed`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-navy-900/40 uppercase tracking-widest ml-1">Phone Number</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClasses} placeholder="+91 00000 00000" />
                </div>
              </div>

              {saved && (
                <div className="mt-6 flex items-center gap-2 text-sm text-emerald-600 font-bold animate-in fade-in slide-in-from-bottom-2">
                  <CheckCircle2 className="w-5 h-5" /> Changes saved successfully
                </div>
              )}
            </div>
          </Card>

          <Card hover={false} className="p-8 rounded-[2rem] border-border/40 shadow-sm">
            <PasswordChangeForm />
          </Card>
        </div>

        {/* Info Side */}
        <div className="space-y-6">
          <Card hover={false} className="p-8 rounded-[2rem] border-0 bg-navy-900 text-white shadow-xl shadow-navy-900/20">
            <h3 className="text-lg font-heading font-black mb-6">Work Details</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-primary-300" />
                </div>
                <div>
                  <p className="text-[10px] text-primary-300 uppercase font-black tracking-widest mb-1">Current Role</p>
                  <p className="text-sm font-bold text-white">{employee.designation || 'Team Member'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <div className="w-5 h-5 text-primary-300 font-bold text-center">D</div>
                </div>
                <div>
                  <p className="text-[10px] text-primary-300 uppercase font-black tracking-widest mb-1">Department</p>
                  <p className="text-sm font-bold text-white">{employee.department || 'Operations'}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <div className="w-5 h-5 text-primary-300 font-bold text-center">J</div>
                </div>
                <div>
                  <p className="text-[10px] text-primary-300 uppercase font-black tracking-widest mb-1">Member Since</p>
                  <p className="text-sm font-bold text-white">
                    {employee.created_at ? new Date(employee.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="p-8 rounded-[2rem] bg-primary-50 border border-primary-100">
            <MFASetup initialEnabled={employee.mfa_enabled || false} />
          </div>

          <div className="p-8 rounded-[2rem] bg-navy-50/50 border border-navy-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-black text-primary-900">Security Note</p>
            </div>
            <p className="text-xs text-primary-800/80 leading-relaxed font-medium">
              Your email and work details are managed by HR. If you notice any discrepancy, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
