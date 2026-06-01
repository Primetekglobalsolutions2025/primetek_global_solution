'use client';

import { useState, useTransition } from 'react';
import { Megaphone, AlertTriangle, Info, Plus, Trash2, Clock, Users, User, Loader2, Pin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useToast } from '@/components/ui/Toast';
import { SentNotification, createNotification, deleteNotification, togglePinNotification, deleteMultipleNotifications, updateNotification } from './actions';

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

  // States for pinning, select mode, editing, and multi-select deletion
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNotification, setEditingNotification] = useState<SentNotification | null>(null);
  const [isTogglingPin, setIsTogglingPin] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  const { toast } = useToast();

  const handleStartEdit = (notif: SentNotification) => {
    setEditingNotification(notif);
    setTitle(notif.title);
    setMessage(notif.message);
    setType(notif.type || 'announcement');
    setAudience(notif.employee_id ? 'targeted' : 'broadcast');
    setSelectedEmployeeId(notif.employee_id || '');
  };

  const handleCancelEdit = () => {
    setEditingNotification(null);
    setTitle('');
    setMessage('');
    setType('announcement');
    setAudience('broadcast');
    setSelectedEmployeeId('');
  };

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
      
      if (editingNotification) {
        const res = await updateNotification(editingNotification.id, title.trim(), message.trim(), type, recipientId);
        
        if (res.success && res.notification) {
          toast.success('Notification updated successfully.');
          
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

          setNotifications(prev => prev.map(n => n.id === editingNotification.id ? {
            ...n,
            title: res.notification.title,
            message: res.notification.message,
            type: res.notification.type,
            employee_id: res.notification.employee_id,
            employees: matchedEmp
          } : n));
          
          handleCancelEdit();
        } else {
          toast.error(res.error || 'Failed to update notification');
        }
      } else {
        const res = await createNotification(title.trim(), message.trim(), type, recipientId);
        
        if (res.success && res.notification) {
          toast.success('Notification dispatched successfully.');
          
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
            is_pinned: false,
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
        if (selectedIds.has(deleteTarget.id)) {
          const newSelected = new Set(selectedIds);
          newSelected.delete(deleteTarget.id);
          setSelectedIds(newSelected);
        }
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

  const handleTogglePin = async (id: string) => {
    setIsTogglingPin(id);
    try {
      const res = await togglePinNotification(id);
      if (res.success) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_pinned: res.isPinned ?? !n.is_pinned } : n))
        );
        toast.success(res.isPinned ? 'Notification pinned.' : 'Notification unpinned.');
      } else {
        toast.error(res.error || 'Failed to toggle pin state');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsTogglingPin(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const res = await deleteMultipleNotifications(idsToDelete);
      if (res.success) {
        toast.success('Selected notifications deleted.');
        setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
        setSelectedIds(new Set());
      } else {
        toast.error(res.error || 'Failed to delete selected notifications');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  const getExpiryText = (createdAtStr: string) => {
    const createdAt = new Date(createdAtStr);
    const expiryTime = createdAt.getTime() + 3 * 24 * 60 * 60 * 1000;
    const remainingMs = expiryTime - Date.now();
    if (remainingMs <= 0) return 'Expired';
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
    if (remainingHours >= 24) {
      const days = Math.floor(remainingHours / 24);
      return `Expires in ${days}d`;
    }
    return `Expires in ${remainingHours}h`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Sent History Column */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {isSelectMode && notifications.length > 0 && (
                <input
                  type="checkbox"
                  checked={selectedIds.size === notifications.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(notifications.map(n => n.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  title="Select all notifications"
                />
              )}
              <h2 className="font-extrabold text-navy-900 text-base tracking-tight font-sans">Sent Notifications</h2>
            </div>
            <div className="flex items-center gap-2">
              {isSelectMode && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteConfirmOpen(true)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-extrabold rounded-lg flex items-center gap-1 cursor-pointer border-0 active:scale-95 transition-all shadow-sm font-sans"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete ({selectedIds.size})
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    setSelectedIds(new Set());
                  }}
                  className="px-3 py-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-650 text-[10px] font-extrabold rounded-lg active:scale-95 transition-all cursor-pointer bg-white font-sans"
                >
                  {isSelectMode ? 'Cancel' : 'Select'}
                </button>
              )}
              <span className="bg-primary-50 text-primary-600 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans">
                {notifications.length} dispatched
              </span>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#E2E8F0] rounded-xl text-zinc-455 flex-1">
              <Megaphone className="w-8 h-8 stroke-[1.5] mb-2 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-wider">No Active Dispatches</p>
              <p className="text-[10px] text-zinc-400 mt-1 max-w-[250px] text-center font-medium">Broadcasts or targeted alerts you dispatch will be listed here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-150">
              {notifications.map((notif) => {
                const dateStr = new Date(notif.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });

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
                }[notif.type || 'announcement'] || {
                  icon: <Info className="w-4 h-4 text-[#3B82F6]" />,
                  bg: 'bg-[#EFF6FF] border-[#EFF6FF]/10'
                };

                const isBroadcast = notif.employee_id === null;

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "py-4 flex gap-3.5 relative overflow-hidden transition-all duration-200",
                      notif.is_pinned && "bg-amber-50/10",
                      selectedIds.has(notif.id) && "bg-primary-50/5"
                    )}
                  >
                    {/* Checkbox (Only visible in select mode) */}
                    {isSelectMode && (
                      <div className="flex items-center justify-center shrink-0 pr-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(notif.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIds);
                            if (e.target.checked) {
                              newSelected.add(notif.id);
                            } else {
                              newSelected.delete(notif.id);
                            }
                            setSelectedIds(newSelected);
                          }}
                          className="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                      </div>
                    )}

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
                      
                      <p className="text-[10px] text-[#64748B] font-medium leading-relaxed line-clamp-2 md:line-clamp-3">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
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

                        {notif.is_pinned ? (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                            📌 Pinned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-500 border-zinc-200">
                            <Clock className="w-2 h-2 text-zinc-450" /> {getExpiryText(notif.created_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions (Hidden in select mode) */}
                    {!isSelectMode && (
                      <div className="flex items-center gap-1.5 self-start pl-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(notif.id)}
                          disabled={isTogglingPin === notif.id}
                          className={cn(
                            "p-1 rounded active:scale-95 transition-all cursor-pointer border-0 bg-transparent",
                            notif.is_pinned
                              ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                              : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                          )}
                          title={notif.is_pinned ? "Unpin Notification" : "Pin Notification"}
                        >
                          <Pin className={cn("w-3.5 h-3.5", notif.is_pinned && "fill-amber-500")} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(notif)}
                          className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-[#64748B] hover:text-navy-900 rounded text-[9px] font-bold transition-all border-0 cursor-pointer active:scale-95"
                          title="Edit Notification"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(notif)}
                          className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
                          title="Delete Notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
          <h3 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider mb-4">
            {editingNotification ? 'Edit Alert' : 'Compose Alert'}
          </h3>
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

            <div className="space-y-2 pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold uppercase tracking-wider py-3 flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer border-0"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {editingNotification ? 'Saving...' : 'Dispatching...'}
                  </>
                ) : (
                  <>
                    {editingNotification ? <Pin className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingNotification ? 'Save Changes' : 'Dispatch Alert'}
                  </>
                )}
              </Button>

              {editingNotification && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancelEdit}
                  className="w-full text-xs font-bold uppercase tracking-wider py-2.5 border text-[#64748B]"
                >
                  Cancel Edit
                </Button>
              )}
            </div>
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

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Delete Multiple Notifications?"
        message={`Are you sure you want to delete the ${selectedIds.size} selected notifications? This action cannot be undone.`}
        confirmLabel="Delete All Selected"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isBulkDeleting}
      />

      {/* Floating Action Bar for Bulk Deletion */}
      {isSelectMode && selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy-900 border border-navy-800 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50"
        >
          <span className="text-xs font-bold font-sans">
            {selectedIds.size} {selectedIds.size === 1 ? 'notification' : 'notifications'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2 rounded-full flex items-center gap-1.5 cursor-pointer border-0 active:scale-95 transition-all shadow-md font-sans"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-semibold text-zinc-300 hover:text-white px-3 py-2 cursor-pointer bg-transparent border-0 font-sans"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
