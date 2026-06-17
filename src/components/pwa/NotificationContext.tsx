'use client';

import React, { createContext, useContext, useState, useEffect, useTransition, useCallback } from 'react';
import { Bell, X, Megaphone, AlertTriangle, Info, Clock, CheckSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { 
  getNotificationsForEmployee, 
  markNotificationRead, 
  markAllNotificationsRead,
  AppNotification 
} from '@/app/employee/notifications/actions';
import { getNotificationsForAdmin, markAllAdminNotificationsRead } from '@/app/admin/notifications/actions';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ 
  children, 
  employeeId,
  role
}: { 
  children: React.ReactNode;
  employeeId?: string;
  role?: 'admin' | 'employee' | 'hr';
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const refreshNotifications = useCallback(async () => {
    if (!employeeId) return;
    const isAdmin = role === 'admin' || role === 'hr';
    const res = isAdmin 
      ? await getNotificationsForAdmin(employeeId)
      : await getNotificationsForEmployee(employeeId);

    if (res.success && res.notifications) {
      setNotifications(res.notifications as AppNotification[]);
    }
  }, [employeeId, role]);

  useEffect(() => {
    if (!employeeId) return;
    refreshNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, [employeeId, refreshNotifications]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const handleMarkAsRead = async (id: string) => {
    if (!employeeId) return;
    
    // Optimistic UI update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );

    const res = await markNotificationRead(id, employeeId);
    if (!res.success) {
      // Revert if failed
      refreshNotifications();
      toast.error(res.error || 'Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!employeeId) return;
    if (unreadCount === 0) return;

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    startTransition(async () => {
      const isAdmin = role === 'admin' || role === 'hr';
      const res = isAdmin
        ? await markAllAdminNotificationsRead(employeeId)
        : await markAllNotificationsRead(employeeId);
      
      if (res.success) {
        toast.success('All notifications marked as read');
      } else {
        refreshNotifications();
        toast.error(res.error || 'Failed to mark all as read');
      }
    });
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isOpen,
      open,
      close,
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead,
      refreshNotifications
    }}>
      {children}
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 z-[100] bg-navy-900/45 backdrop-blur-xs flex justify-end"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-[101] w-full max-w-[430px] bg-[#F7F8FA] shadow-2xl border-l border-[#E8EDF2] flex flex-col font-sans h-full"
            >
              {/* Header with single-line guarantee */}
              <div className="h-[72px] bg-white border-b border-[#E8EDF2] px-4 flex items-center justify-between shrink-0 flex-nowrap gap-2">
                <div className="flex items-center gap-2 flex-nowrap min-w-0">
                  <div className="relative shrink-0">
                    <Bell className="w-5 h-5 text-navy-900 stroke-[1.8]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                    )}
                  </div>
                  <h3 className="text-sm font-extrabold text-navy-900 truncate whitespace-nowrap">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-primary-50 text-primary-600 text-[9px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllAsRead}
                      disabled={isPending}
                      className="text-[9px] font-extrabold text-primary-600 hover:text-primary-700 py-1.5 px-2.5 bg-primary-50 rounded-full active:scale-95 transition-all flex items-center gap-1 border-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckSquare className="w-3 h-3" />
                      )}
                      Mark read
                    </button>
                  )}
                  
                  <button 
                    onClick={close}
                    className="p-1 rounded-full hover:bg-zinc-50 text-[#64748B] hover:text-navy-900 transition-colors border-0 cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-white border border-[#E8EDF2] flex items-center justify-center text-[#64748B] shadow-3xs">
                      <Bell className="w-5 h-5 stroke-[1.5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-extrabold text-navy-900 uppercase tracking-wide">No Notifications</p>
                      <p className="text-[11px] text-[#64748B] mt-1 font-medium leading-relaxed max-w-[200px] mx-auto">
                        You are all caught up! Announcements from admin will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isUnread = !notif.is_read;
                    const dateStr = new Date(notif.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });

                    const iconConfig = {
                      announcement: {
                        icon: <Megaphone className="w-4.5 h-4.5 text-[#F59E0B]" />,
                        bg: 'bg-[#FFF7EB] border-[#FFF7EB]/10'
                      },
                      alert: {
                        icon: <AlertTriangle className="w-4.5 h-4.5 text-[#EF4444]" />,
                        bg: 'bg-[#FEF2F2] border-[#FEF2F2]/10'
                      },
                      personal: {
                        icon: <Info className="w-4.5 h-4.5 text-[#3B82F6]" />,
                        bg: 'bg-[#EFF6FF] border-[#EFF6FF]/10'
                      }
                    }[notif.type || 'announcement'] || {
                      icon: <Info className="w-4.5 h-4.5 text-[#3B82F6]" />,
                      bg: 'bg-[#EFF6FF] border-[#EFF6FF]/10'
                    };

                    return (
                      <div
                        key={notif.id}
                        onClick={() => isUnread && handleMarkAsRead(notif.id)}
                        className={cn(
                          "p-4 rounded-2xl border bg-white flex gap-3.5 transition-all shadow-3xs relative overflow-hidden select-none cursor-pointer",
                          isUnread ? "border-primary-600/30 hover:border-primary-600/50 ring-1 ring-primary-600/10" : "border-[#E8EDF2] hover:bg-zinc-50/50"
                        )}
                      >
                        {/* Type Icon */}
                        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 border", iconConfig.bg)}>
                          {iconConfig.icon}
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className={cn("text-[12px] leading-tight font-extrabold text-navy-900", isUnread && "font-black")}>
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

                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[8px] font-bold text-zinc-400 uppercase font-mono">
                              From: {notif.sender_name}
                            </span>
                            {isUnread && (
                              <>
                                <span className="w-1 h-1 bg-zinc-400 rounded-full" />
                                <span className="text-[8px] font-extrabold text-primary-600 uppercase tracking-wider font-mono">
                                  Mark as read
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Unread indicator dot */}
                        {isUnread && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-primary-600 rounded-full" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      isOpen: false,
      open: () => {},
      close: () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      refreshNotifications: async () => {}
    };
  }
  return context;
}
