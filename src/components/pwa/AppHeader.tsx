'use client';

import { Bell } from 'lucide-react';
import Logo from '@/components/ui/Logo';

interface AppHeaderProps {
  userName?: string;
  role?: 'admin' | 'employee' | 'hr';
}

export default function AppHeader({ userName, role }: AppHeaderProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const initials = userName 
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : 'PG';

  return (
    <header className={`h-14 md:h-16 border-b flex items-center px-4 md:px-6 shrink-0 sticky top-0 z-30 ${
      role === 'admin' ? 'bg-[#090e17] border-navy-800' : 'bg-white border-border'
    }`}>
      <div className="flex-1 min-w-0">
        {/* Mobile/Tablet: show logo */}
        <div className="flex md:hidden items-center gap-3 py-1">
          <Logo className="w-32 h-auto shrink-0" dark={role === 'admin'} />
        </div>
        {/* Desktop: show greeting */}
        <div className="hidden md:block">
          <p className={`text-[11px] uppercase tracking-widest font-bold leading-none ${
            role === 'admin' ? 'text-slate-400' : 'text-text-muted'
          }`}>
            {getGreeting()}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className={`relative p-2 rounded-xl transition-colors ${
          role === 'admin'
            ? 'text-slate-400 hover:text-white hover:bg-navy-900/60'
            : 'text-gray-400 hover:text-navy-900 hover:bg-surface-alt'
        }`} aria-label="Notifications">
          <Bell className="w-5 h-5" />
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ${
            role === 'admin' ? 'ring-2 ring-[#090e17]' : 'ring-2 ring-white'
          }`} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md shadow-primary-500/20">
          <span className="text-[10px] font-bold text-white">{initials}</span>
        </div>
      </div>
    </header>
  );
}
