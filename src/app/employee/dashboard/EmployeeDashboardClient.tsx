'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  Clock, 
  ClipboardList, 
  User, 
  MoreHorizontal, 
  Bell, 
  ArrowRight, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Loader2, 
  Users, 
  Megaphone,
  LayoutGrid,
  Contact,
  Headset
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { updatePortalHolidays } from '../attendance/actions';
import Logo from '@/components/ui/Logo';

interface Holiday {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'Company Holiday' | 'Optional Holiday' | 'Public Holiday';
}

interface EmployeeDashboardClientProps {
  employee: {
    name: string;
    employee_id: string;
    role: string;
    department: string;
    designation?: string;
  } | null;
  todayRecord: {
    check_in: string;
    check_out: string | null;
    duration_hours: number;
    status: string;
  } | null;
  totalRemainingLeaves: number;
  initialHolidays: Holiday[];
  isAdmin: boolean;
}

export default function EmployeeDashboardClient({
  employee,
  todayRecord,
  totalRemainingLeaves,
  initialHolidays,
  isAdmin
}: EmployeeDashboardClientProps) {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'report' | 'profile' | 'more'>('home');

  // Calendar state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isHelpdeskOpen, setIsHelpdeskOpen] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [currentDate, setCurrentDate] = useState(new Date(2025, 7, 1)); // Default to August 2025 to show Independence Day
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2025, 7, 15)); // Default to Aug 15, 2025
  
  // Holiday form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<Holiday['type']>('Company Holiday');
  const [isPending, startTransition] = useTransition();

  // Live timer for Hours Worked today (if clocked in and not clocked out)
  const [liveHours, setLiveHours] = useState('0h 00m');

  useEffect(() => {
    if (todayRecord && todayRecord.check_in && !todayRecord.check_out) {
      // User is currently clocked in. Calculate dynamic elapsed time
      const checkInTime = new Date(todayRecord.check_in).getTime();
      
      const updateTimer = () => {
        const elapsedMs = Date.now() - checkInTime;
        if (elapsedMs < 0) {
          setLiveHours('0h 00m');
          return;
        }
        const totalMinutes = Math.floor(elapsedMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        setLiveHours(`${hours}h ${String(mins).padStart(2, '0')}m`);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 60000); // Update every minute
      return () => clearInterval(interval);
    } else if (todayRecord && todayRecord.check_out) {
      // User clocked out, show final duration
      const totalMinutes = Math.round(todayRecord.duration_hours * 60);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setLiveHours(`${hours}h ${String(mins).padStart(2, '0')}m`);
    } else {
      setLiveHours('0h 00m');
    }
  }, [todayRecord]);

  // Determine current active holiday display
  const activeHoliday = holidays.find(h => {
    if (!selectedDate) return false;
    const hDate = new Date(h.date);
    return (
      hDate.getDate() === selectedDate.getDate() &&
      hDate.getMonth() === selectedDate.getMonth() &&
      hDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  // Calendar calculations
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddHoliday = () => {
    if (!newHolidayTitle.trim() || !selectedDate) return;
    
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    
    const newHoliday: Holiday = {
      id: Math.random().toString(36).substr(2, 9),
      title: newHolidayTitle.trim(),
      date: dateStr,
      type: newHolidayType
    };

    const updatedHolidays = [...holidays, newHoliday];

    startTransition(async () => {
      const res = await updatePortalHolidays(JSON.stringify(updatedHolidays));
      if (res.success) {
        setHolidays(updatedHolidays);
        setNewHolidayTitle('');
        setShowAddForm(false);
      } else {
        alert(res.error || 'Failed to save holiday');
      }
    });
  };

  const handleDeleteHoliday = (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    
    const updatedHolidays = holidays.filter(h => h.id !== id);

    startTransition(async () => {
      const res = await updatePortalHolidays(JSON.stringify(updatedHolidays));
      if (res.success) {
        setHolidays(updatedHolidays);
      } else {
        alert(res.error || 'Failed to delete holiday');
      }
    });
  };

  // Render Calendar Grid Days
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  // Default display upcoming holiday (closest future holiday)
  const upcomingHoliday = holidays
    .map(h => ({ ...h, dateObj: new Date(h.date) }))
    .filter(h => h.dateObj.getTime() >= new Date(2025, 7, 1).getTime()) // Filter matching sample timeline
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())[0];

  const formattedUpcomingDate = upcomingHoliday
    ? `${upcomingHoliday.dateObj.getDate()} ${upcomingHoliday.dateObj.toLocaleDateString('en-IN', { month: 'short' })} ${upcomingHoliday.dateObj.getFullYear()} (${upcomingHoliday.dateObj.toLocaleDateString('en-IN', { weekday: 'long' })})`
    : 'No upcoming holidays';

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#F7F8FA] pb-[98px] shadow-lg border-x border-[#E8EDF2] flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP HEADER */}
      <header className="h-[72px] bg-white border-b border-[#E8EDF2] px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto" />
        </div>

        <div className="flex items-center gap-3">
          <button className="w-[44px] h-[44px] rounded-full flex items-center justify-center text-[#64748B] hover:bg-zinc-50 active:scale-95 transition-all">
            <Bell className="w-5 h-5 stroke-[1.8]" />
          </button>
          
          {/* Avatar Profile Box */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#071B3A] to-[#0B8B83] flex items-center justify-center text-white text-[15px] font-bold shadow-sm">
            {employee?.name ? employee.name.charAt(0).toUpperCase() : 'J'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-5 space-y-5 overflow-y-auto">
        
        {/* 2. HERO SECTION */}
        <section className="h-[230px] rounded-[24px] bg-gradient-to-r from-[#071B3A] to-[#0B8B83] relative overflow-hidden p-5 flex flex-col justify-between shadow-sm">
          {/* Background Decorative Rings */}
          <div className="absolute top-[-20%] right-[-10%] w-[160px] h-[160px] rounded-full border border-white/10" />
          <div className="absolute top-[-30%] right-[-20%] w-[210px] h-[210px] rounded-full border border-white/5" />
          
          <div className="space-y-4">
            <div className="bg-white/10 text-[#12C7BC] text-[10px] font-semibold py-1 px-3 w-fit rounded-full uppercase tracking-wider backdrop-blur-xs font-mono">
              EMPLOYEE ID : {employee?.employee_id || 'CMK5936306'}
            </div>
            
            <div>
              <p className="text-white/80 text-sm">Good Morning,</p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mt-0.5 flex items-center gap-1.5">
                {employee?.name ? employee.name.split(' ')[0] : 'Janu'} <span className="animate-bounce">≡ƒæï</span>
              </h1>
              <p className="text-white/60 text-[11px] mt-1.5 leading-relaxed">
                Welcome back! Here's what's happening today.
              </p>
            </div>
          </div>

          {/* Bottom Action Cards */}
          <div className="flex gap-3 relative z-10">
            {/* Clock In/Out */}
            <Link href="/employee/attendance" className="flex-1">
              <div className="bg-white rounded-[20px] p-3 flex items-center justify-between shadow-sm cursor-pointer hover:bg-zinc-50 active:scale-[0.98] transition-all border border-transparent hover:border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#E6F3F2] flex items-center justify-center text-[#0B8B83] shrink-0">
                    <Clock className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-extrabold text-[#071B3A] leading-tight">Clock In / Out</span>
                    <span className="text-[9px] text-[#64748B] leading-none mt-0.5 font-medium">Track your attendance</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
              </div>
            </Link>

            {/* Request Leave */}
            <Link href="/employee/leaves" className="flex-1">
              <div className="bg-white/15 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/20 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#12C7BC] shrink-0">
                    <Calendar className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-extrabold text-white leading-tight">Request Leave</span>
                    <span className="text-[9px] text-white/70 leading-none mt-0.5 font-medium">Apply for leave</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </div>
            </Link>
          </div>

          {/* Floating 3D Attendance Illustration */}
          <div className="absolute top-4 right-1.5 w-[112px] h-[112px] opacity-90 select-none pointer-events-none">
            <Image 
              src="/clock_image_transparent.png" 
              alt="Attendance" 
              width={112} 
              height={112} 
              className="object-contain" 
              priority
            />
          </div>
        </section>

        {/* 3. TODAY'S OVERVIEW SECTION */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-[#071B3A]">Today's Overview</h2>
            <Link href="/employee/attendance" className="text-[11px] font-bold text-[#0B8B83] hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {/* Hours Worked */}
            <div className="bg-white border border-[#EEF2F6] rounded-[20px] p-2.5 flex flex-col items-center justify-center text-center shadow-3xs">
              <div className="w-8 h-8 rounded-full bg-[#E6F3F2] flex items-center justify-center text-[#0B8B83] mb-2.5">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#071B3A] tracking-tight">{liveHours}</span>
              <span className="text-[8px] font-bold text-[#64748B] mt-1.5 leading-none">Hours Worked</span>
              <span className="text-[7px] font-semibold text-[#94A3B8] mt-0.5">Today</span>
            </div>

            {/* Leaves Available */}
            <div className="bg-white border border-[#EEF2F6] rounded-[20px] p-2.5 flex flex-col items-center justify-center text-center shadow-3xs">
              <div className="w-8 h-8 rounded-full bg-[#FFF7EB] flex items-center justify-center text-[#F59E0B] mb-2.5">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#071B3A] tracking-tight">{totalRemainingLeaves}</span>
              <span className="text-[8px] font-bold text-[#64748B] mt-1.5 leading-none">Leaves Available</span>
              <span className="text-[7px] font-semibold text-[#94A3B8] mt-0.5">Balance</span>
            </div>

            {/* Last Check In */}
            <div className="bg-white border border-[#EEF2F6] rounded-[20px] p-2.5 flex flex-col items-center justify-center text-center shadow-3xs">
              <div className="w-8 h-8 rounded-full bg-[#F3E8FF] flex items-center justify-center text-[#8B5CF6] mb-2.5">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#071B3A] tracking-tight">
                {todayRecord && todayRecord.check_in 
                  ? new Date(todayRecord.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) 
                  : '--:--'}
              </span>
              <span className="text-[8px] font-bold text-[#64748B] mt-1.5 leading-none">Last Check In</span>
              <span className="text-[7px] font-semibold text-[#94A3B8] mt-0.5">Today</span>
            </div>

            {/* Last Check Out */}
            <div className="bg-white border border-[#EEF2F6] rounded-[20px] p-2.5 flex flex-col items-center justify-center text-center shadow-3xs">
              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#3B82F6] mb-2.5">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#071B3A] tracking-tight">
                {todayRecord && todayRecord.check_out 
                  ? new Date(todayRecord.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) 
                  : '--:--'}
              </span>
              <span className="text-[8px] font-bold text-[#64748B] mt-1.5 leading-none">Last Check Out</span>
              <span className="text-[7px] font-semibold text-[#94A3B8] mt-0.5">Today</span>
            </div>
          </div>
        </section>

        {/* 4. QUICK ACCESS SECTION */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <h2 className="text-[14px] font-extrabold text-[#071B3A]">Quick Access</h2>
          
          <div className="grid grid-cols-5 gap-1">
            {/* My Tasks */}
            <Link href="/employee/assigned-profiles" className="flex flex-col items-center text-center w-full min-w-0">
              <div className="w-[50px] h-[50px] rounded-[16px] bg-[#E6F3F2] flex items-center justify-center text-[#0B8B83] active:scale-95 transition-all">
                <ClipboardList className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-medium text-[#64748B] mt-2 text-center leading-tight tracking-tight w-full break-words">My Tasks</span>
            </Link>

            {/* My Clients */}
            <Link href="/employee/assigned-profiles" className="flex flex-col items-center text-center w-full min-w-0">
              <div className="w-[50px] h-[50px] rounded-[16px] bg-[#EFF6FF] flex items-center justify-center text-[#3B82F6] active:scale-95 transition-all">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-medium text-[#64748B] mt-2 text-center leading-tight tracking-tight w-full break-words">My Clients</span>
            </Link>

            {/* Daily Report */}
            <Link href="/employee/daily-report" className="flex flex-col items-center text-center w-full min-w-0">
              <div className="w-[50px] h-[50px] rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#8B5CF6] active:scale-95 transition-all">
                <ClipboardList className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-medium text-[#64748B] mt-2 text-center leading-tight tracking-tight w-full break-words">Daily Report</span>
            </Link>

            {/* Announcements */}
            <div className="flex flex-col items-center text-center cursor-pointer w-full min-w-0">
              <div className="w-[50px] h-[50px] rounded-[16px] bg-[#FFF7EB] flex items-center justify-center text-[#F59E0B] active:scale-95 transition-all">
                <Megaphone className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-medium text-[#64748B] mt-2 text-center leading-tight tracking-tight w-full break-words">Announcements</span>
            </div>

            {/* Helpdesk */}
            <div 
              onClick={() => setIsHelpdeskOpen(true)}
              className="flex flex-col items-center text-center cursor-pointer w-full min-w-0"
            >
              <div className="w-[50px] h-[50px] rounded-[16px] bg-[#FFF1F2] flex items-center justify-center text-[#F43F5E] active:scale-95 transition-all">
                <Headset className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-medium text-[#64748B] mt-2 text-center leading-tight tracking-tight w-full break-words">Helpdesk</span>
            </div>
          </div>
        </section>

        {/* 5. MY PROFILE SECTION */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-[#071B3A]">My Profile</h2>
            <Link href="/employee/profile" className="text-[11px] font-bold text-[#0B8B83] hover:underline flex items-center gap-0.5">
              View Profile <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex gap-4 items-center">
            {/* Avatar Box */}
            <div className="w-[72px] h-[72px] rounded-[20px] bg-[#E6F3F2] flex flex-col items-center justify-center text-[#0B8B83] relative overflow-hidden shrink-0 border border-[#E8EDF2]">
              <User className="w-8 h-8" />
              <div className="flex items-center gap-1 absolute bottom-1.5">
                <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />
                <span className="text-[7px] font-bold text-[#64748B] uppercase tracking-wide">Online</span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-1">
              <h3 className="text-[15px] font-extrabold text-[#071B3A] leading-tight">
                {employee?.role === 'hr' ? 'HR Specialist' : (employee?.designation || 'Marketing Executive')}
              </h3>
              <p className="text-[11px] font-bold text-[#64748B] leading-none">
                {employee?.department || 'Marketing Department'}
              </p>
            </div>
          </div>

          {/* Bottom Profile Details Row */}
          <div className="border-t border-[#EEF2F6] pt-3.5 flex justify-between gap-4">
            <div>
              <p className="text-[8px] font-bold text-[#94A3B8] uppercase">Employee ID</p>
              <p className="text-[11px] font-extrabold text-[#071B3A] mt-0.5">{employee?.employee_id || 'CMK5936306'}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#94A3B8] uppercase">System Role</p>
              <p className="text-[11px] font-extrabold text-[#0B8B83] mt-0.5 uppercase">{employee?.role || 'EMPLOYEE'}</p>
            </div>
          </div>
        </section>

        {/* 6. UPCOMING SECTION */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-[#071B3A]">Upcoming</h2>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              className="text-[11px] font-bold text-[#0B8B83] hover:underline flex items-center gap-0.5"
            >
              View Calendar <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {upcomingHoliday ? (
            <div className="flex items-center justify-between border border-[#EEF2F6] rounded-[20px] p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E6F8F2] flex items-center justify-center text-[#22C55E] shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-extrabold text-[#071B3A]">{upcomingHoliday.title}</span>
                  <span className="text-[9px] font-bold text-[#64748B]">{formattedUpcomingDate}</span>
                </div>
              </div>
              <span className="bg-[#E6F8F2] text-[#22C55E] text-[8px] font-bold py-1 px-2.5 rounded-full uppercase shrink-0 border border-[#22C55E]/10">
                {upcomingHoliday.type}
              </span>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-[#94A3B8] border border-dashed border-[#E8EDF2] rounded-[20px]">
              No scheduled upcoming holidays
            </div>
          )}
        </section>

      </main>

      {/* 7. BOTTOM TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-[78px] bg-white border-t border-[#E8EDF2] flex items-center justify-around z-45 px-4 pb-safe max-w-[430px] mx-auto shadow-md">
        
        {/* Home */}
        <Link href="/employee/dashboard" className="flex flex-col items-center justify-center gap-1 cursor-pointer flex-1 h-full">
          <LayoutGrid className="w-5 h-5 text-[#0B8B83] stroke-[2.2]" />
          <span className="text-[10px] font-bold text-[#0B8B83]">Home</span>
        </Link>

        {/* Attendance */}
        <Link href="/employee/attendance" className="flex flex-col items-center justify-center gap-1 cursor-pointer flex-1 h-full text-[#94A3B8] hover:text-[#0B8B83] transition-colors">
          <Clock className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] font-bold">Attendance</span>
        </Link>

        {/* Daily Report */}
        <Link href="/employee/daily-report" className="flex flex-col items-center justify-center gap-1 cursor-pointer flex-1 h-full text-[#94A3B8] hover:text-[#0B8B83] transition-colors">
          <ClipboardList className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] font-bold">Daily Report</span>
        </Link>

        {/* Profiles */}
        <Link href="/employee/assigned-profiles" className="flex flex-col items-center justify-center gap-1 cursor-pointer flex-1 h-full text-[#94A3B8] hover:text-[#0B8B83] transition-colors">
          <Contact className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] font-bold">Profiles</span>
        </Link>

        {/* More / Profile */}
        <Link href="/employee/profile" className="flex flex-col items-center justify-center gap-1 cursor-pointer flex-1 h-full text-[#94A3B8] hover:text-[#0B8B83] transition-colors">
          <MoreHorizontal className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] font-bold">More</span>
        </Link>

      </nav>

      {/* 8. INTERACTIVE CALENDAR & HOLIDAY MANAGEMENT MODAL */}
      {isCalendarOpen && (
        <div className="fixed inset-0 bg-[#071B3A]/45 backdrop-blur-xs flex items-end justify-center z-50 p-4 max-w-[430px] mx-auto animate-fade-in">
          <div className="bg-white rounded-t-[28px] w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl border-t border-[#E8EDF2] flex flex-col justify-between animate-slide-up">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-[#EEF2F6]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0B8B83]" />
                <h3 className="text-base font-extrabold text-[#071B3A]">Office Holidays Calendar</h3>
              </div>
              <button 
                onClick={() => {
                  setIsCalendarOpen(false);
                  setShowAddForm(false);
                }}
                className="text-xs font-bold text-[#64748B] hover:text-[#071B3A] py-1 px-3 bg-[#F7F8FA] rounded-full active:scale-95 transition-all"
              >
                Close
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-extrabold text-[#071B3A]">
                {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-1 bg-[#F7F8FA] p-1 rounded-full">
                <button 
                  onClick={handlePrevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-[#64748B] hover:text-[#071B3A] transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-[#64748B] hover:text-[#071B3A] transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-1">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[#94A3B8] text-[9px] uppercase tracking-wider">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>
              
              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-[#071B3A]">
                {/* Blanks */}
                {blanksArray.map(b => (
                  <div key={`blank-${b}`} className="aspect-square flex items-center justify-center opacity-0 pointer-events-none" />
                ))}

                {/* Days */}
                {daysArray.map(day => {
                  const thisDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  
                  // Check if day is selected
                  const isSelected = selectedDate && 
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === currentDate.getMonth() &&
                    selectedDate.getFullYear() === currentDate.getFullYear();
                  
                  // Check if day has a holiday
                  const dayHoliday = holidays.find(h => {
                    const hDate = new Date(h.date);
                    return (
                      hDate.getDate() === day &&
                      hDate.getMonth() === currentDate.getMonth() &&
                      hDate.getFullYear() === currentDate.getFullYear()
                    );
                  });

                  return (
                    <div 
                      key={`day-${day}`}
                      onClick={() => {
                        setSelectedDate(thisDate);
                        setShowAddForm(false);
                      }}
                      className={cn(
                        "aspect-square flex flex-col items-center justify-center rounded-full relative cursor-pointer active:scale-90 transition-all select-none hover:bg-zinc-50 border border-transparent",
                        isSelected && "bg-[#0B8B83] text-white hover:bg-[#0B8B83]",
                        dayHoliday && !isSelected && "bg-[#E6F8F2] text-[#22C55E]"
                      )}
                    >
                      <span>{day}</span>
                      
                      {/* Holiday Dot */}
                      {dayHoliday && (
                        <div className={cn(
                          "w-1 h-1 rounded-full absolute bottom-1",
                          isSelected ? "bg-white" : "bg-[#22C55E]"
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Details */}
            {selectedDate && (
              <div className="bg-[#F7F8FA] rounded-2xl p-4 border border-[#E8EDF2] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase">
                    {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                  
                  {isAdmin && activeHoliday && (
                    <button 
                      onClick={() => handleDeleteHoliday(activeHoliday.id)}
                      disabled={isPending}
                      className="text-[9px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 py-1 px-2.5 rounded-full bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Delete
                    </button>
                  )}
                </div>

                {activeHoliday ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-extrabold text-[#071B3A]">{activeHoliday.title}</p>
                      <p className="text-[10px] font-bold text-[#64748B]">{activeHoliday.type}</p>
                    </div>
                    <span className="bg-[#E6F8F2] text-[#22C55E] text-[8px] font-bold py-1 px-2 rounded-full uppercase border border-[#22C55E]/10">
                      Office Closed
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B]">Normal working day.</p>
                    
                    {/* Admin Add Holiday Trigger */}
                    {isAdmin && !showAddForm && (
                      <button 
                        onClick={() => setShowAddForm(true)}
                        className="text-xs font-bold text-[#0B8B83] hover:text-[#0d6460] flex items-center gap-1 cursor-pointer py-1.5 px-3 bg-white border border-[#E8EDF2] rounded-lg active:scale-95 shadow-3xs transition-all w-fit"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Give Sudden Holiday
                      </button>
                    )}
                  </div>
                )}

                {/* Admin Add Holiday Form */}
                {isAdmin && showAddForm && (
                  <div className="pt-2 border-t border-[#EEF2F6] space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#64748B] uppercase">Holiday Title</label>
                      <input 
                        type="text" 
                        value={newHolidayTitle}
                        onChange={(e) => setNewHolidayTitle(e.target.value)}
                        placeholder="e.g. Sudden Monsoon Holiday"
                        className="w-full bg-white border border-[#E8EDF2] rounded-lg py-1.5 px-3 text-xs text-[#071B3A] placeholder-[#94A3B8] focus:border-[#0B8B83] focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#64748B] uppercase">Holiday Type</label>
                      <select 
                        value={newHolidayType}
                        onChange={(e) => setNewHolidayType(e.target.value as Holiday['type'])}
                        className="w-full bg-white border border-[#E8EDF2] rounded-lg py-1.5 px-3 text-xs text-[#071B3A] focus:border-[#0B8B83] focus:outline-none transition-all"
                      >
                        <option value="Company Holiday">Company Holiday (Mandatory)</option>
                        <option value="Optional Holiday">Optional Holiday</option>
                        <option value="Public Holiday">Public Holiday</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={handleAddHoliday}
                        disabled={isPending || !newHolidayTitle.trim()}
                        className="flex-1 bg-[#0B8B83] hover:bg-[#0d6460] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Holiday
                      </button>
                      <button 
                        onClick={() => setShowAddForm(false)}
                        className="bg-[#EEF2F6] hover:bg-[#E8EDF2] text-[#64748B] text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. HELPDESK & SUPPORT MODAL */}
      {isHelpdeskOpen && (
        <div className="fixed inset-0 bg-[#071B3A]/45 backdrop-blur-xs flex items-end justify-center z-50 p-4 max-w-[430px] mx-auto animate-fade-in">
          <div className="bg-white rounded-t-[28px] w-full p-6 space-y-5 shadow-xl border-t border-[#E8EDF2] flex flex-col justify-between animate-slide-up">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-[#EEF2F6]">
              <div className="flex items-center gap-2">
                <Headset className="w-5 h-5 text-[#0B8B83]" />
                <h3 className="text-base font-extrabold text-[#071B3A]">HR Helpdesk & Support</h3>
              </div>
              <button 
                onClick={() => setIsHelpdeskOpen(false)}
                className="text-xs font-bold text-[#64748B] hover:text-[#071B3A] py-1 px-3 bg-[#F7F8FA] rounded-full active:scale-95 transition-all border-0 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-left">
              <p className="text-xs text-[#64748B] font-medium leading-relaxed">
                Need assistance with your shifts, salary discrepancies, or system access? Reach out to our HR Helpdesk.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#F7F8FA] rounded-xl border border-[#EEF2F6]">
                  <div className="w-8 h-8 rounded-lg bg-[#E6F3F2] flex items-center justify-center text-[#0B8B83] shrink-0">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase">HR Representative</p>
                    <p className="text-xs font-extrabold text-[#071B3A]">Sarah Jenkins (HR Ops)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#F7F8FA] rounded-xl border border-[#EEF2F6]">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#3B82F6] shrink-0">
                    <Headset className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Support Helpline</p>
                    <a href="tel:+15550192834" className="text-xs font-extrabold text-[#0B8B83] hover:underline">+1 (555) 019-2834</a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#F7F8FA] rounded-xl border border-[#EEF2F6]">
                  <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#8B5CF6] shrink-0">
                    <Bell className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Email Support</p>
                    <a href="mailto:support@primetekglobal.com?subject=HR%20Helpdesk%20Inquiry" className="text-xs font-extrabold text-[#0B8B83] hover:underline">support@primetekglobal.com</a>
                  </div>
                </div>
              </div>
            </div>

            <a 
              href="mailto:support@primetekglobal.com?subject=HR%20Helpdesk%20Inquiry"
              className="w-full bg-[#0B8B83] hover:bg-[#0d6460] text-white text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer no-underline text-center"
            >
              <Headset className="w-4 h-4" />
              SEND EMAIL REQUEST
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
