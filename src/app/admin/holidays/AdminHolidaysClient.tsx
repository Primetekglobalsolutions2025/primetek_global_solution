'use client';

import { useState, useTransition } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Info, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useToast } from '@/components/ui/Toast';
import { Holiday, addHoliday, deleteHoliday } from './actions';

export default function AdminHolidaysClient({ 
  initialHolidays 
}: { 
  initialHolidays: Holiday[] 
}) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Company Holiday' | 'Optional Holiday' | 'Public Holiday'>('Company Holiday');
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();

  const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
  const daysInMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < monthStart.getDay(); i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isHolidayForDay = (dayNum: number) => {
    if (!dayNum) return null;
    const dStr = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return holidays.find(h => h.date === dStr);
  };

  const currentMonthHolidays = holidays.filter(h => {
    const hDate = new Date(h.date);
    return hDate.getMonth() === selectedMonthDate.getMonth() && hDate.getFullYear() === selectedMonthDate.getFullYear();
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + (direction === 'prev' ? -1 : 1), 1));
  };

  const handleDateClick = (dayNum: number) => {
    const targetDate = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), dayNum);
    setSelectedDate(targetDate);
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a holiday title');
      return;
    }

    const formattedDate = selectedDate.toISOString().split('T')[0];

    startTransition(async () => {
      const res = await addHoliday(title.trim(), formattedDate, type);
      if (res.success && res.holiday) {
        toast.success(`Holiday "${title}" announced successfully.`);
        const newHoliday: Holiday = {
          id: res.holiday.id,
          title: res.holiday.title,
          date: res.holiday.date,
          type: res.holiday.type
        };
        setHolidays(prev => [...prev, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
        setTitle('');
      } else {
        toast.error(res.error || 'Failed to add holiday');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteHoliday(deleteTarget.id);
      if (res.success) {
        toast.success(`Holiday "${deleteTarget.title}" deleted.`);
        setHolidays(prev => prev.filter(h => h.id !== deleteTarget.id));
      } else {
        toast.error(res.error || 'Failed to delete holiday');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const selectedHoliday = selectedDate ? isHolidayForDay(selectedDate.getDate()) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Calendar Column */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between flex-1 bg-white">
          <div>
            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary-600" />
                <h2 className="font-bold text-[#0F172A] text-base tracking-tight font-sans">Holiday Calendar</h2>
              </div>
              
              {/* Month navigation controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigateMonth('prev')}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 cursor-pointer transition-colors border-0 bg-transparent"
                >
                  <ChevronLeft className="w-4.5 h-4.5" />
                </button>
                <div className="px-3.5 py-1.5 rounded-lg bg-[#E2E8F0]/40 text-navy-900 text-xs font-black uppercase tracking-wider font-mono min-w-[130px] text-center">
                  {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => navigateMonth('next')}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 cursor-pointer transition-colors border-0 bg-transparent"
                >
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 text-center mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
                <div key={index} className="text-xs font-bold text-[#64748B] py-1 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Date grid area */}
            <div className="grid grid-cols-7 gap-y-3 justify-items-center text-center">
              {calendarDays.map((day, i) => {
                const isSelected = selectedDate && day === selectedDate.getDate() && selectedDate.getMonth() === selectedMonthDate.getMonth() && selectedDate.getFullYear() === selectedMonthDate.getFullYear();
                const isToday = day === new Date().getDate() && selectedMonthDate.getMonth() === new Date().getMonth() && selectedMonthDate.getFullYear() === new Date().getFullYear();
                const holiday = day ? isHolidayForDay(day) : null;

                return (
                  <div key={i} className="flex flex-col items-center justify-center relative select-none">
                    {day ? (
                      <button
                        type="button"
                        onClick={() => handleDateClick(day)}
                        className={cn(
                          "w-10 h-10 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer border relative",
                          isSelected
                            ? "bg-navy-900 text-white border-navy-900 shadow-md scale-105"
                            : isToday
                              ? "bg-zinc-100 text-navy-900 border-zinc-300 font-extrabold"
                              : holiday
                                ? "bg-primary-50 text-primary-600 border-primary-600/30 hover:bg-primary-50 font-black"
                                : "text-[#0F172A] hover:bg-[#F8FAFC] border-transparent"
                        )}
                      >
                        <span>{day}</span>
                        {holiday && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 bg-primary-600 rounded-full" />
                        )}
                      </button>
                    ) : (
                      <div className="w-10 h-10" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-start gap-4 items-center border-t border-[#E2E8F0] pt-4 mt-6 text-[10px] font-bold text-[#64748B] uppercase">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-50 border border-primary-600/30" />
              <span>Company Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-100 border border-zinc-300" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-navy-900" />
              <span>Selected</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Control Form Column */}
      <div className="lg:col-span-4 flex flex-col space-y-6">
        {/* Selected Date Card */}
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white space-y-4">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest block font-mono">Date Status</h3>
          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 text-primary-600 mt-0.5" />
            <div>
              <p className="font-bold text-navy-900 text-sm">
                {selectedDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  weekday: 'long'
                })}
              </p>
              {selectedHoliday ? (
                <div className="mt-2 inline-flex items-center gap-1 bg-primary-50 text-primary-600 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-primary-600/10 uppercase tracking-wider font-mono">
                  {selectedHoliday.type}
                </div>
              ) : (
                <p className="text-xs text-zinc-450 mt-1">Normal Working Day</p>
              )}
            </div>
          </div>

          {selectedHoliday && (
            <div className="p-3 rounded-lg border border-teal-200 bg-primary-50/20 text-xs font-semibold text-primary-600 flex gap-2">
              <Info className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{selectedHoliday.title}</p>
                <p className="text-[10px] opacity-80 mt-0.5">This day is announced as a holiday. Employees will see this on their dashboard and attendance calendar.</p>
              </div>
            </div>
          )}
        </Card>

        {/* Holiday list card */}
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider">Holidays in {selectedMonthDate.toLocaleDateString('en-IN', { month: 'long' })}</h3>
            <span className="bg-primary-50 text-primary-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
              {currentMonthHolidays.length} scheduled
            </span>
          </div>

          {currentMonthHolidays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-[#E2E8F0] rounded-xl text-zinc-400">
              <Info className="w-6 h-6 stroke-[1.5] mb-2" />
              <p className="text-xs">No holidays scheduled for this month</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-150">
              {currentMonthHolidays.map((h) => {
                const formattedDate = new Date(h.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  weekday: 'short'
                });
                return (
                  <div key={h.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0 font-sans text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center text-primary-600">
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-navy-900">{h.title}</span>
                        <span className="text-[10px] text-primary-600 font-semibold">{h.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] font-bold text-[#64748B] bg-zinc-100 px-2 py-0.5 rounded border">{formattedDate}</span>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(h)}
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

        {/* Announce Holiday Form */}
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white">
          <h3 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider mb-4">Announce Holiday</h3>
          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Selected Date</label>
              <Input
                type="text"
                disabled
                value={selectedDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Holiday Title</label>
              <Input
                type="text"
                placeholder="Independence Day, Diwali, etc."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Holiday Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white cursor-pointer"
              >
                <option value="Company Holiday">Company Holiday (Mandatory Off)</option>
                <option value="Public Holiday">Public Holiday (Government Holiday)</option>
                <option value="Optional Holiday">Optional Holiday (Restricted Off)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold uppercase tracking-wider py-3 flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer border-0 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Announce Holiday
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>

      {/* Confirmation Modal for Deletion */}
      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Holiday?"
        message={`Are you sure you want to remove the holiday "${deleteTarget?.title}" on ${deleteTarget ? new Date(deleteTarget.date).toLocaleDateString('en-IN') : ''}? This will re-enable it as a normal working day for all employees.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
