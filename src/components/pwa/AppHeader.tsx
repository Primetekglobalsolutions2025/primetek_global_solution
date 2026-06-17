'use client';

import { Bell } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { useNotifications } from '@/components/pwa/NotificationContext';

interface AppHeaderProps {
  userName?: string;
  notificationCount?: number;
  role?: string;
}

export default function AppHeader({ userName, notificationCount }: AppHeaderProps) {
  const { toast } = useToast();
  const notifications = useNotifications();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const initials = userName 
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : 'PG';

  const handleNotificationClick = () => {
    if (notifications) {
      notifications.open();
    } else {
      if (notificationCount && notificationCount > 0) {
        toast.info(`You have ${notificationCount} pending approval${notificationCount > 1 ? 's' : ''} requiring attention.`);
      } else {
        toast.info('No new notifications at this time.');
      }
    }
  };

  const displayCount = notifications ? notifications.unreadCount : (notificationCount || 0);

  return (
    <header className="h-14 md:h-16 border-b flex items-center px-4 md:px-6 shrink-0 sticky top-0 z-30 bg-white border-border">
      <div className="flex-1 min-w-0">
        {/* Mobile/Tablet: show logo */}
        <div className="flex md:hidden items-center gap-3 py-1">
          <Logo className="w-40 h-auto shrink-0" dark={false} />
        </div>
        {/* Desktop: show greeting */}
        <div className="hidden md:block">
          <p className="text-[11px] uppercase tracking-widest font-bold leading-none text-text-muted">
            {getGreeting()}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={handleNotificationClick}
          className="relative p-2 rounded-xl transition-colors text-gray-400 hover:text-navy-900 hover:bg-surface-alt border-0 cursor-pointer" 
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {displayCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center text-[7px] text-white font-bold">
              {displayCount}
            </span>
          )}
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md shadow-primary-500/20">
          <span className="text-[10px] font-bold text-white">{initials}</span>
        </div>
      </div>
    </header>
  );
}
