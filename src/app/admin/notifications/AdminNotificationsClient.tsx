'use client';

import { useState, useTransition } from 'react';
import { Megaphone, AlertTriangle, Info, Plus, Trash2, Clock, Users, User, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useToast } from '@/components/ui/Toast';
import { SentNotification, createNotification, deleteNotification } from './actions';

interface EmployeeSummary {
  id: string;
  name: string;
  employee_id: string;
}

export default function AdminNotificationsClient({
  employees,
  initialNotifications
}: {
  employees: EmployeeSummary[];
  initialNotifications: SentNotification[];
}) {
  const [notifications, setNotifications] = useState<SentNotification[]>(initialNotifications);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'announcement' | 'personal' | 'alert'>('announcement');
  const [audience, setAudience] = useState<'broadcast' | 'targeted'>('broadcast');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<SentNotification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    if (audience === 'targeted' && !selectedEmployeeId) {
      toast.error('Please select a recipient employee.');
      return;
    }

    startTransition(async () => {
      const recipientId = audience === 'broadcast' ? null : selectedEmployeeId;
      const res = await createNotification(title.trim(), message.trim(), type, recipientId);
      
      if (res.success && res.notification) {
        toast.success('Notification dispatched successfully.');
        
        // Find matching employee object if targeted
        let matchedEmp = null;
        if (recipientId) {
          const emp = employees.find(e => e.id === recipientId);
          if (emp) {
            matchedEmp = {
              name: emp.name,
              employee_id: emp.employee_id
            };
          }
        }

        const newNotif: SentNotification = {
          id: res.notification.id,
          title: res.notification.title,
          message: res.notification.message,
          type: res.notification.type,
          employee_id: res.notification.employee_id,
          sender_name: res.notification.sender_name,
          is_read: res.notification.is_read,
          created_at: res.notification.created_at,
          employees: matchedEmp
        };

        setNotifications(prev => [newNotif, ...prev]);
        setTitle('');
        setMessage('');
        setSelectedEmployeeId('');
      } else {
        toast.error(res.error || 'Failed to dispatch notification');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteNotification(deleteTarget.id);
      if (res.success) {
        toast.success('Notification deleted successfully.');
        setNotifications(prev => prev.filter(n => n.id !== deleteTarget.id));
      } else {
        toast.error(res.error || 'Failed to delete notification');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Sent History Column */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-extrabold text-navy-900 text-base tracking-tight font-sans">Dispatch Logs</h2>
            <span className="bg-primary-50 text-primary-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
              {notifications.length} dispatched
            </span>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#E2E8F0] rounded-xl text-zinc-450 flex-1">
              <Megaphone className="w-8 h-8 stroke-[1.5] mb-2 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-wider">No Active Dispatches</p>
              <p className="text-[10px] text-zinc-400 mt-1 max-w-[250px] text-center font-medium">Broadcasts or targeted alerts you dispatch will be listed here.</p>
            </div>
          ) : (
            <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[650px] pr-1">
              {notifications.map((notif) => {
                const dateStr = new Date(notif.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });

                // Icon configs
                const iconConfig = {
                  announcement: {
                    icon: <Megaphone className="w-4 h-4 text-[#F59E0B]" />,
                    bg: 'bg-[#FFF7EB] border-[#FFF7EB]/10'
                  },
                  alert: {
                    icon: <AlertTriangle className="w-4 h-4 text-[#EF4444]" />,
                    bg: 'bg-[#FEF2F2] border-[#FEF2F2]/10'
                  },
                  personal: {
                    icon: <Info className="w-4 h-4 text-[#3B82F6]" />,
                    bg: 'bg-[#EFF6FF] border-[#EFF6FF]/10'
                  }
                }[notif.type || 'announcement'];

                const isBroadcast = notif.employee_id === null;

                return (
                  <div
                    key={notif.id}
                    className="p-4 rounded-xl border border-[#E8EDF2] bg-white flex gap-3.5 shadow-3xs relative overflow-hidden select-none"
                  >
                    {/* Type Icon */}
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 border", iconConfig.bg)}>
                      {iconConfig.icon}
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-[12px] leading-tight font-extrabold text-navy-900">
                          {notif.title}
                        </h4>
                        <span className="text-[8px] font-bold text-[#94A3B8] flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {dateStr}
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-[#64748B] font-medium leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border bg-zinc-100 text-zinc-550">
                          {isBroadcast ? (
                            <><Users className="w-2.5 h-2.5 text-zinc-400" /> Broadcast</>
                          ) : (
                            <><User className="w-2.5 h-2.5 text-primary-600" /> {notif.employees?.name || 'Selected Employee'}</>
                          )}
                        </span>
                        
                        {!isBroadcast && (
                          <span className={cn(
                            "text-[8px] font-black py-0.5 px-2 rounded-full leading-none border uppercase font-mono",
                            notif.is_read ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"
                          )}>
                            {notif.is_read ? 'Read' : 'Unread'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-start self-start pl-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(notif)}
                        className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Control Form Column */}
      <div className="lg:col-span-4">
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white">
          <h3 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider mb-4">Compose Alert</h3>
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Title</label>
              <Input
                type="text"
                placeholder="Important Announcement, System Maintenance, etc."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Message</label>
              <Textarea
                placeholder="Compose your notification content here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Alert Severity</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white cursor-pointer"
              >
                <option value="announcement">Announcement (General Broadcast)</option>
                <option value="alert">Alert (High Priority Alert)</option>
                <option value="personal">Personal Info (System Info)</option>
              </select>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Audience</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAudience('broadcast')}
                  className={cn(
                    "py-2 px-3 border rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all",
                    audience === 'broadcast'
                      ? "bg-navy-900 border-navy-900 text-white"
                      : "bg-white border-zinc-200 text-navy-900 hover:bg-zinc-50"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  All Staff
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('targeted')}
                  className={cn(
                    "py-2 px-3 border rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all",
                    audience === 'targeted'
                      ? "bg-navy-900 border-navy-900 text-white"
                      : "bg-white border-zinc-200 text-navy-900 hover:bg-zinc-50"
                  )}
                >
                  <User className="w-3.5 h-3.5" />
                  Target Staff
                </button>
              </div>
            </div>

            {audience === 'targeted' && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Recipient Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white cursor-pointer"
                  required
                >
                  <option value="">Select Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold uppercase tracking-wider py-3 flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer border-0 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Dispatch Alert
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Notification Dispatch?"
        message={`Are you sure you want to delete the notification "${deleteTarget?.title}"? Employees will no longer see this alert in their in-app notifications panel.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
