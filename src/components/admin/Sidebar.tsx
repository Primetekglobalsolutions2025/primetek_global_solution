'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, MessageSquare, FileText, Calendar, Users, Clock, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/inquiries', icon: MessageSquare, label: 'Inquiries' },
  { href: '/admin/applications', icon: FileText, label: 'Applications' },
  { href: '/admin/interview-requests', icon: Calendar, label: 'Interview Requests' },
  { href: '/admin/employees', icon: Users, label: 'Employees' },
  { href: '/admin/attendance', icon: Clock, label: 'Attendance' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  userName?: string;
}

export default function Sidebar({ userName = 'Admin' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('primetek-admin-session');
      localStorage.removeItem('primetek-admin-session');
      localStorage.removeItem('primetek-admin-token');
      localStorage.removeItem('primetek-session');
      localStorage.removeItem('primetek-token');
    } catch {}
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-navy-900 text-white transition-all duration-300 min-h-screen',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm">
              P
            </div>
            <span className="font-bold text-sm">
              Primetek<span className="text-primary-400">.</span>
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary-500/15 text-primary-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0 transition-transform" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 space-y-1">
        {!collapsed && (
          <div className="px-3 py-1.5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Signed in as</p>
            <p className="text-xs font-semibold text-zinc-300 truncate">{userName}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 h-10 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
