'use client';

import { useState } from 'react';
import { Bell, ToggleLeft, ToggleRight } from 'lucide-react';
import { updateAdminNotificationPreferences } from '@/app/admin/profile/actions';
import { useToast } from '@/components/ui/Toast';

interface NotificationPreferences {
  leave_approval_required: boolean;
  attendance_issues: boolean;
  daily_reports_submitted: boolean;
  new_applications: boolean;
  system_alerts: boolean;
}

export default function AdminNotificationPreferences({
  initialPreferences
}: {
  initialPreferences?: NotificationPreferences;
}) {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const defaults: NotificationPreferences = {
      leave_approval_required: true,
      attendance_issues: true,
      daily_reports_submitted: true,
      new_applications: true,
      system_alerts: true
    };
    return initialPreferences || defaults;
  });
  const [saving, setSaving] = useState(false);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newPrefs = {
      ...preferences,
      [key]: !preferences[key]
    };
    setPreferences(newPrefs);
    setSaving(true);
    try {
      const res = await updateAdminNotificationPreferences(newPrefs);
      if (res && res.success) {
        toast.success('Notification preferences updated successfully.');
      } else {
        toast.error(res?.error || 'Failed to update preferences.');
        // Revert
        setPreferences(preferences);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update preferences.');
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-md bg-primary-500/10 text-primary-650 border border-primary-500/20 flex items-center justify-center">
          <Bell className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-sm font-semibold text-navy-900">Notification Alerts</h2>
      </div>

      <div className="space-y-4">
        {(
          [
            { key: 'leave_approval_required', label: 'Leave Requests Requiring Approval' },
            { key: 'attendance_issues', label: 'Employee Attendance & Clocking Issues' },
            { key: 'daily_reports_submitted', label: 'Daily Metrics & Reports Submissions' },
            { key: 'new_applications', label: 'New Candidate Job Applications' },
            { key: 'system_alerts', label: 'System Health & Security Alerts' },
          ] as const
        ).map((item) => {
          const isEnabled = preferences[item.key];
          return (
            <div key={item.key} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
              <span className="text-xs font-semibold text-zinc-650">{item.label}</span>
              <button
                onClick={() => handleToggle(item.key)}
                disabled={saving}
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
  );
}
