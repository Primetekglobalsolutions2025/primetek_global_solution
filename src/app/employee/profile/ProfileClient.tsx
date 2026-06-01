'use client';

import { useState, useRef, useEffect } from 'react';
import { Save, Loader2, CheckCircle2, Camera, Briefcase, Building2, CalendarRange, Download, Smartphone } from 'lucide-react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PasswordChangeForm from '@/components/profile/PasswordChangeForm';
import MFASetup from '@/components/profile/MFASetup';
import { useRouter } from 'next/navigation';
import { updateProfile, updateAvatar, updateNotificationPreferences } from './actions';
import { useToast } from '@/components/ui/Toast';
import { typography } from '@/styles/design-system';
import { Bell, ToggleLeft, ToggleRight } from 'lucide-react';

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
  notification_preferences?: {
    leave_approved: boolean;
    leave_rejected: boolean;
    attendance_reminder: boolean;
    daily_report_reminder: boolean;
    holiday_reminder: boolean;
    company_announcement: boolean;
  };
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

  const [preferences, setPreferences] = useState(() => {
    const defaults = {
      leave_approved: true,
      leave_rejected: true,
      attendance_reminder: true,
      daily_report_reminder: true,
      holiday_reminder: true,
      company_announcement: true
    };
    return employee.notification_preferences || defaults;
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
        // @ts-expect-error - navigator.standalone is a non-standard iOS Safari property
        || window.navigator.standalone;
      setIsStandalone(isStandaloneMode);

      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info('To install, tap the browser menu (or share button on Safari) and select "Add to Home Screen".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateProfile(form.name, form.phone);
      if (res && res.success) {
        setSaved(true);
        toast.success('Profile details saved successfully.');
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error(res?.error || 'Failed to save profile details.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile details.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async (updatedPrefs: typeof preferences) => {
    setSavingPrefs(true);
    try {
      const res = await updateNotificationPreferences(updatedPrefs);
      if (res && res.success) {
        toast.success('Notification preferences updated successfully.');
        router.refresh();
      } else {
        toast.error(res?.error || 'Failed to update preferences.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update preferences.');
    } finally {
      setSavingPrefs(false);
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
      if (res && res.success) {
        setCurrentAvatarUrl(res.avatarUrl);
        toast.success('Avatar uploaded successfully!');
      } else {
        toast.error(res?.error || 'Failed to upload avatar.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const inputClasses = 'w-full px-3 py-2.5 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm font-sans';

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Clean Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 p-6 overflow-hidden border border-primary-500/20 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          {/* Avatar Section */}
          <div 
            className="w-20 h-20 rounded-lg bg-primary-500 flex items-center justify-center text-white text-2xl font-bold relative group cursor-pointer overflow-hidden ring-2 ring-white/10 shadow-lg"
            onClick={() => fileInputRef.current?.click()}
          >
            {currentAvatarUrl ? (
              <Image src={currentAvatarUrl} alt={employee.name} fill className="object-cover" sizes="80px" priority />
            ) : (
              employee.name ? employee.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'
            )}
            
            <div className="absolute inset-0 bg-navy-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm">
              {avatarUploading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Camera className="w-6 h-6 text-white" />}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>

          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-semibold text-white uppercase tracking-wider border border-white/20 bg-white/10 mb-2">
              Employee
            </span>
            <h1 className={typography.pageTitleLight}>
              {employee.name}
            </h1>
            <p className="text-white/80 text-sm font-medium flex items-center justify-center md:justify-start gap-2 mt-0.5 font-sans">
              {employee.designation || 'Team Member'} 
              <span className="w-1 h-1 rounded-full bg-white/40" /> 
              {employee.department || 'Primetek'}
            </p>
          </div>

          <div className="md:ml-auto flex items-center gap-3">
            <div className="bg-white/10 rounded-lg p-3 border border-white/10 text-center min-w-[90px] backdrop-blur-xs">
              <p className="text-[8px] text-white/60 uppercase font-mono font-semibold tracking-wider mb-0.5">Employee ID</p>
              <p className="text-xs font-mono font-bold text-white uppercase tracking-tight">
                {employee.employee_id || 'Active'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms Side */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-navy-900">Personal Information</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Update your contact details and preferences.</p>
              </div>
              <Button onClick={handleSave} disabled={saving} className="rounded-md shadow-sm px-4 py-2 text-xs font-semibold">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Changes
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Display Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClasses} placeholder="Your full name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Email Address</label>
                <input type="email" value={form.email} disabled className={`${inputClasses} bg-zinc-50 text-zinc-400 cursor-not-allowed`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Phone Number</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClasses} placeholder="+91 00000 00000" />
              </div>
            </div>

            {saved && (
              <div className="mt-5 flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Changes saved successfully
              </div>
            )}
          </div>

          <div className="p-6 rounded-lg border border-zinc-200 shadow-2xs bg-white">
            <PasswordChangeForm />
          </div>
        </div>

        {/* Info Side */}
        <div className="space-y-5">
          <div className="p-6 rounded-lg bg-white border border-zinc-200 shadow-2xs">
            <div className="border-b border-zinc-100 pb-4 mb-5">
              <h3 className="text-sm font-bold text-navy-900">Work Details</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-2.5 rounded-lg hover:bg-zinc-50 transition-all duration-200 border border-transparent hover:border-zinc-100">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 border border-primary-100 text-primary-600 shadow-2xs">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-0.5">Current Role</p>
                  <p className="text-xs font-bold text-navy-900">{employee.designation || 'Team Member'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3.5 p-2.5 rounded-lg hover:bg-zinc-50 transition-all duration-200 border border-transparent hover:border-zinc-100">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 border border-primary-100 text-primary-600 shadow-2xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-0.5">Department</p>
                  <p className="text-xs font-bold text-navy-900">{employee.department || 'Operations'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-2.5 rounded-lg hover:bg-zinc-50 transition-all duration-200 border border-transparent hover:border-zinc-100">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 border border-primary-100 text-primary-600 shadow-2xs">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-0.5">Member Since</p>
                  <p className="text-xs font-bold text-navy-900">
                    {employee.created_at ? new Date(employee.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-primary-50 border border-primary-100">
            <MFASetup initialEnabled={employee.mfa_enabled || false} />
          </div>

          <div className="p-6 rounded-lg bg-white border border-zinc-200 shadow-2xs">
            <div className="border-b border-zinc-100 pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary-500" />
                <h3 className="text-sm font-bold text-navy-900">Notification Alerts</h3>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { key: 'leave_approved', label: 'Leave Approvals' },
                { key: 'leave_rejected', label: 'Leave Rejections' },
                { key: 'attendance_reminder', label: 'Attendance Reminders' },
                { key: 'daily_report_reminder', label: 'Daily Report Reminders' },
                { key: 'holiday_reminder', label: 'Holiday Reminders' },
                { key: 'company_announcement', label: 'Company Announcements' },
              ].map((item) => {
                const isEnabled = (preferences as any)[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                    <span className="text-xs font-semibold text-zinc-650">{item.label}</span>
                    <button
                      onClick={() => {
                        const newPrefs = { ...preferences, [item.key]: !isEnabled };
                        setPreferences(newPrefs);
                        handleSavePreferences(newPrefs);
                      }}
                      disabled={savingPrefs}
                      className="text-primary-600 hover:text-primary-700 transition-all border-0 bg-transparent p-1 cursor-pointer"
                      title={isEnabled ? 'Disable' : 'Enable'}
                    >
                      {isEnabled ? (
                        <ToggleRight className="w-7 h-7 text-primary-600" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-zinc-400" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {!isStandalone && (
            <div className="p-5 rounded-lg bg-white border border-zinc-200 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-navy-950 text-white flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-primary-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-900">Install Portal App</p>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Install app for better experience
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="p-2 rounded bg-navy-900 hover:bg-navy-800 text-white transition-all duration-200 flex items-center justify-center shrink-0 shadow-2xs hover:scale-105"
                  title="Install App"
                  aria-label="Install App"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="p-5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded bg-primary-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-navy-900">Security Note</p>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
              Your email and work details are managed by HR. If you notice any discrepancy, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
