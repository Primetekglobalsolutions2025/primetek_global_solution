import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import AttendanceClient from './AttendanceClient';

export default async function EmployeeAppAttendancePage() {
  const session = await getSession();
  if (!session || !session.id) redirect('/employee/login');

  const { data: records } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('employee_id', session.id)
    .order('date', { ascending: false });

  const empRecords = (records || []).map(r => {
    const checkIn = r.check_in ? new Date(r.check_in) : null;
    const checkOut = r.check_out ? new Date(r.check_out) : null;
    let durationHours = 0;
    
    // Safety check for Invalid Date
    const isValidCheckIn = checkIn && !isNaN(checkIn.getTime());
    const isValidCheckOut = checkOut && !isNaN(checkOut.getTime());

    if (isValidCheckIn && isValidCheckOut) {
      durationHours = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 10) / 10;
    }
    
    return {
      id: r.id,
      date: r.date,
      check_in_raw: r.check_in,
      check_in: isValidCheckIn ? checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null,
      check_out: isValidCheckOut ? checkOut.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null,
      duration_hours: durationHours,
      status: r.status,
      total_break_seconds: r.total_break_seconds,
      current_break_start: r.current_break_start,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-navy-900 tracking-tight">Attendance</h1>
        <p className="text-text-secondary text-sm">Clock in and out using GPS.</p>
      </div>
      <AttendanceClient initialRecords={empRecords} />
    </div>
  );
}
