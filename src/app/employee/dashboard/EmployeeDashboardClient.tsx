'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  ClipboardList, 
  User, 
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
  Headset
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { addHoliday, deleteHoliday } from '@/app/admin/holidays/actions';
import { useToast } from '@/components/ui/Toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import EmployeeApplicationsList from './EmployeeApplicationsList';

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
  applications: any[];
}

export default function EmployeeDashboardClient({
  employee,
  todayRecord,
  totalRemainingLeaves,
  initialHolidays,
  isAdmin,
  applications
}: EmployeeDashboardClientProps) {
  // Calendar state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isHelpdeskOpen, setIsHelpdeskOpen] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [greeting, setGreeting] = useState('Good Morning');
  const [holidayToDelete, setHolidayToDelete] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Holiday form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<Holiday['type']>('Company Holiday');
  const [isPending, startTransition] = useTransition();

  // Live timer for Hours Worked today (if clocked in and not clocked out)
  const [liveHours, setLiveHours] = useState('0h 00m');

  useEffect(() => {
    // Client-side initialization to avoid SSR hydration mismatches
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);

    const hr = now.getHours();
    if (hr < 12) {
      setGreeting('Good Morning');
    } else if (hr < 17) {
      setGreeting('Good Afternoon');
    } else {
      setGreeting('Good Evening');
    }
  }, []);

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
    
    startTransition(async () => {
      const res = await addHoliday(newHolidayTitle.trim(), dateStr, newHolidayType);
      if (res.success && res.holiday) {
        setHolidays(prev => [...prev, {
          id: res.holiday.id,
          title: res.holiday.title,
          date: res.holiday.date,
          type: res.holiday.type
        }]);
        setNewHolidayTitle('');
        setShowAddForm(false);
        toast.success('Holiday added successfully');
      } else {
        toast.error(res.error || 'Failed to save holiday');
      }
    });
  };

  const confirmDeleteHoliday = (id: string) => {
    setHolidayToDelete(id);
  };

  const executeDeleteHoliday = () => {
    if (!holidayToDelete) return;
    const id = holidayToDelete;

    startTransition(async () => {
      const res = await deleteHoliday(id);
      if (res.success) {
        setHolidays(prev => prev.filter(h => h.id !== id));
        toast.success('Holiday deleted successfully');
      } else {
        toast.error(res.error || 'Failed to delete holiday');
      }
      setHolidayToDelete(null);
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
    .filter(h => h.dateObj.getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())[0];

  const formattedUpcomingDate = upcomingHoliday
    ? `${upcomingHoliday.dateObj.getDate()} ${upcomingHoliday.dateObj.toLocaleDateString('en-IN', { month: 'short' })} ${upcomingHoliday.dateObj.getFullYear()} (${upcomingHoliday.dateObj.toLocaleDateString('en-IN', { weekday: 'long' })})`
    : 'No upcoming holidays';

  return (
    <div className="relative w-full">
      <main className="space-y-5 py-2">
        
        {/* 2. HERO SECTION */}
        <section className="min-h-[255px] rounded-[24px] bg-gradient-to-r from-navy-900 to-primary-600 relative overflow-hidden p-5 flex flex-col justify-between gap-4 shadow-sm">
          {/* Background Decorative Rings */}
          <div className="absolute top-[-20%] right-[-10%] w-[160px] h-[160px] rounded-full border border-white/10" />
          <div className="absolute top-[-30%] right-[-20%] w-[210px] h-[210px] rounded-full border border-white/5" />
          
          <div className="space-y-4">
            <div className="bg-white/10 text-primary-400 text-[10px] font-semibold py-1 px-3 w-fit rounded-full uppercase tracking-wider backdrop-blur-xs font-mono">
              EMPLOYEE ID : {employee?.employee_id || 'CMK5936306'}
            </div>
            
            <div>
              <p className="text-white/80 text-sm">{greeting},</p>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mt-0.5 flex items-center gap-1.5">
                {employee?.name ? employee.name.split(' ')[0] : 'Janu'} <span className="animate-bounce">👋</span>
              </h1>
              <p className="text-white/60 text-[11px] mt-1.5 pb-2 leading-relaxed">
                Welcome back! Here&apos;s what&apos;s happening today.
              </p>
            </div>
          </div>

          {/* Bottom Action Cards */}
          <div className="flex gap-3 relative z-10">
            {/* Clock In/Out */}
            <Link href="/employee/attendance" className="flex-1">
              <div className="bg-white/15 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/20 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary-400 shrink-0">
                    <Clock className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-extrabold text-white leading-tight">Clock In / Out</span>
                    <span className="text-[9px] text-white/70 leading-none mt-0.5 font-medium">Track your attendance</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </div>
            </Link>

            {/* Request Leave */}
            <Link href="/employee/leaves" className="flex-1">
              <div className="bg-white/15 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/20 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary-400 shrink-0">
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
        <section data-testid="today-overview" className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-navy-900">Today&apos;s Overview</h2>
            <Link href="/employee/attendance" className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Hours Worked */}
            <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
              <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Hours Worked</span>
              <span className="text-[12px] font-bold text-navy-900 tracking-tight leading-none mb-2">{liveHours}</span>
              <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-primary-50 text-primary-600 border border-primary-600/10 uppercase font-mono">
                Today
              </span>
            </div>

            {/* Leaves Available */}
            <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
              <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Leaves Available</span>
              <span className="text-[12px] font-bold text-navy-900 tracking-tight leading-none mb-2">{totalRemainingLeaves}</span>
              <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-amber-50 text-[#F59E0B] border border-amber-100/30 uppercase font-mono">
                Balance
              </span>
            </div>

            {/* Last Check In */}
            <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
              <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Last Check In</span>
              <span className="text-[12px] font-bold text-navy-900 tracking-tight leading-none mb-2">
                {todayRecord && todayRecord.check_in 
                  ? new Date(todayRecord.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) 
                  : '--:--'}
              </span>
              <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-purple-50 text-[#8B5CF6] border border-purple-100/30 uppercase font-mono">
                Today
              </span>
            </div>

            {/* Last Check Out */}
            <div className="bg-white border border-[#EEF2F6] rounded-[16px] py-3.5 px-1.5 flex flex-col items-center justify-center text-center shadow-3xs min-h-[96px]">
              <span className="text-[8px] font-extrabold text-[#64748B] mb-1.5 uppercase tracking-wider leading-none">Last Check Out</span>
              <span className="text-[12px] font-bold text-navy-900 tracking-tight leading-none mb-2">
                {todayRecord && todayRecord.check_out 
                  ? new Date(todayRecord.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) 
                  : '--:--'}
              </span>
              <span className="text-[8px] font-extrabold py-0.5 px-2 rounded-full leading-none shrink-0 bg-blue-50 text-[#3B82F6] border border-blue-100/30 uppercase font-mono">
                Today
              </span>
            </div>
          </div>
        </section>

        {/* Job Applications Section */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-navy-900 font-sans">My Job Applications</h2>
            <span className="text-[10px] font-bold text-zinc-400 font-sans">
              {applications.length} submitted
            </span>
          </div>
          <EmployeeApplicationsList 
            applications={applications} 
            employeeName={employee?.name || ''} 
          />
        </section>

        {/* 4. QUICK ACCESS SECTION */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <h2 className="text-[14px] font-extrabold text-navy-900">Quick Access</h2>
          
          <div className="grid grid-cols-5 gap-1">
            {/* My Tasks */}
            <Link href="/employee/assigned-profiles" className="flex flex-col items-center text-center w-full min-w-0">
              <div className="w-[50px] h-[50px] rounded-[16px] bg-primary-50 flex items-center justify-center text-primary-600 active:scale-95 transition-all">
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
            <h2 className="text-[14px] font-extrabold text-navy-900">My Profile</h2>
            <Link href="/employee/profile" className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5">
              View Profile <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex gap-4 items-center">
            {/* Avatar Box */}
            <div className="w-[72px] h-[72px] rounded-[20px] bg-primary-50 flex flex-col items-center justify-center text-primary-600 relative overflow-hidden shrink-0 border border-[#E8EDF2]">
              <User className="w-8 h-8" />
              <div className="flex items-center gap-1 absolute bottom-1.5">
                <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />
                <span className="text-[7px] font-bold text-[#64748B] uppercase tracking-wide">Online</span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-1">
              <h3 className="text-[15px] font-extrabold text-navy-900 leading-tight">
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
              <p className="text-[11px] font-extrabold text-navy-900 mt-0.5">{employee?.employee_id || 'CMK5936306'}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#94A3B8] uppercase">System Role</p>
              <p className="text-[11px] font-extrabold text-primary-600 mt-0.5 uppercase">{employee?.role || 'EMPLOYEE'}</p>
            </div>
          </div>
        </section>

        {/* 6. UPCOMING SECTION */}
        <section className="bg-white rounded-[20px] p-5 border border-[#E8EDF2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-navy-900">Upcoming</h2>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              View Calendar <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {upcomingHoliday ? (
            <div className="flex items-center justify-between border border-[#EEF2F6] rounded-[20px] p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-[#22C55E] shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-extrabold text-navy-900">{upcomingHoliday.title}</span>
                  <span className="text-[9px] font-bold text-[#64748B]">{formattedUpcomingDate}</span>
                </div>
              </div>
              <span className="bg-primary-50 text-[#22C55E] text-[8px] font-bold py-1 px-2.5 rounded-full uppercase shrink-0 border border-[#22C55E]/10">
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



      {/* 8. INTERACTIVE CALENDAR & HOLIDAY MANAGEMENT MODAL */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-t-[28px] md:rounded-[24px] w-full md:max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl border-t md:border border-[#E8EDF2] flex flex-col justify-between"
            >
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-[#EEF2F6]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                <h3 className="text-base font-extrabold text-navy-900">Office Holidays Calendar</h3>
              </div>
              <button 
                onClick={() => {
                  setIsCalendarOpen(false);
                  setShowAddForm(false);
                }}
                className="text-xs font-bold text-[#64748B] hover:text-navy-900 py-1 px-3 bg-[#F7F8FA] rounded-full active:scale-95 transition-all"
              >
                Close
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-extrabold text-navy-900">
                {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-1 bg-[#F7F8FA] p-1 rounded-full">
                <button 
                  onClick={handlePrevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-[#64748B] hover:text-navy-900 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-[#64748B] hover:text-navy-900 transition-all"
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
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-navy-900">
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
                        isSelected && "bg-primary-600 text-white hover:bg-primary-600",
                        dayHoliday && !isSelected && "bg-primary-50 text-[#22C55E]"
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
                      onClick={() => confirmDeleteHoliday(activeHoliday.id)}
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
                      <p className="text-sm font-extrabold text-navy-900">{activeHoliday.title}</p>
                      <p className="text-[10px] font-bold text-[#64748B]">{activeHoliday.type}</p>
                    </div>
                    <span className="bg-primary-50 text-[#22C55E] text-[8px] font-bold py-1 px-2 rounded-full uppercase border border-[#22C55E]/10">
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
                        className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer py-1.5 px-3 bg-white border border-[#E8EDF2] rounded-lg active:scale-95 shadow-3xs transition-all w-fit"
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
                        className="w-full bg-white border border-[#E8EDF2] rounded-lg py-1.5 px-3 text-xs text-navy-900 placeholder-[#94A3B8] focus:border-primary-600 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[#64748B] uppercase">Holiday Type</label>
                      <select 
                        value={newHolidayType}
                        onChange={(e) => setNewHolidayType(e.target.value as Holiday['type'])}
                        className="w-full bg-white border border-[#E8EDF2] rounded-lg py-1.5 px-3 text-xs text-navy-900 focus:border-primary-600 focus:outline-none transition-all"
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
                        className="flex-1 bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. HELPDESK & SUPPORT MODAL */}
      <AnimatePresence>
        {isHelpdeskOpen && (
          <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-t-[28px] md:rounded-[24px] w-full md:max-w-md p-6 space-y-5 shadow-xl border-t md:border border-[#E8EDF2] flex flex-col justify-between"
            >
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-[#EEF2F6]">
              <div className="flex items-center gap-2">
                <Headset className="w-5 h-5 text-primary-600" />
                <h3 className="text-base font-extrabold text-navy-900">HR Helpdesk & Support</h3>
              </div>
              <button 
                onClick={() => setIsHelpdeskOpen(false)}
                className="text-xs font-bold text-[#64748B] hover:text-navy-900 py-1 px-3 bg-[#F7F8FA] rounded-full active:scale-95 transition-all border-0 cursor-pointer"
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
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase">HR Representative</p>
                    <p className="text-xs font-extrabold text-navy-900">Sarah Jenkins (HR Ops)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#F7F8FA] rounded-xl border border-[#EEF2F6]">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#3B82F6] shrink-0">
                    <Headset className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Support Helpline</p>
                    <a href="tel:+15550192834" className="text-xs font-extrabold text-primary-600 hover:underline">+1 (555) 019-2834</a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#F7F8FA] rounded-xl border border-[#EEF2F6]">
                  <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#8B5CF6] shrink-0">
                    <Bell className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Email Support</p>
                    <a href="mailto:support@primetekglobal.com?subject=HR%20Helpdesk%20Inquiry" className="text-xs font-extrabold text-primary-600 hover:underline">support@primetekglobal.com</a>
                  </div>
                </div>
              </div>
            </div>

            <a 
              href="mailto:support@primetekglobal.com?subject=HR%20Helpdesk%20Inquiry"
              className="w-full bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer no-underline text-center"
            >
              <Headset className="w-4 h-4" />
              SEND EMAIL REQUEST
            </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!holidayToDelete}
        onClose={() => setHolidayToDelete(null)}
        onConfirm={executeDeleteHoliday}
        title="Delete Holiday"
        message="Are you sure you want to delete this holiday? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
