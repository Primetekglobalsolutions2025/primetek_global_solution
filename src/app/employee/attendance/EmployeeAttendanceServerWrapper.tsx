import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import AttendanceClient from './AttendanceClient';
import { closeStaleSessions } from './actions';
import { getISTShiftDate } from '@/lib/utils';

export default async function EmployeeAttendanceServerWrapper() {
  const session = await getSession();
  if (!session || !session.id) redirect('/employee/login');

  const currentShiftDate = getISTShiftDate();

  await closeStaleSessions();

  // Fetch employee details and attendance records in parallel
  const [
    { data: employee },
    { data: records }
  ] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('name, employee_id, role, department, designation')
      .eq('id', session.id)
      .single(),
    supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', session.id)
      .order('date', { ascending: false })
  ]);

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
      awaiting_desktop_deadline: r.awaiting_desktop_deadline,
      device_type: r.device_type,
      device_label: r.device_label,
      productive_hours: r.productive_hours || 0,
    };
  });

  // Check if the most recent closed session was auto-logged-out by the system sweeper
  let wasAutoLoggedOut = false;
  const todayRecord = (records || []).find(r => r.date === currentShiftDate);
  if (!todayRecord || todayRecord.check_out) {
    // No active session today ΓÇö check if the previous session was force-closed
    const lastClosedRecord = (records || []).find(r => r.check_out !== null);
    if (lastClosedRecord) {
      const { data: lastEvents } = await supabaseAdmin
        .from('attendance_events')
        .select('event_type, payload')
        .eq('session_id', lastClosedRecord.id)
        .eq('event_type', 'FORCE_LOGOUT')
        .limit(1);
      if (lastEvents && lastEvents.length > 0) {
        const payload = lastEvents[0]?.payload as Record<string, unknown> | null;
        if (payload?.forced_by === 'system_sweeper') {
          wasAutoLoggedOut = true;
        }
      }
    }
  }

  return (
    <AttendanceClient 
      employee={employee}
      employeeId={session.id} 
      initialRecords={empRecords} 
      wasAutoLoggedOut={wasAutoLoggedOut} 
    />
  );
}
