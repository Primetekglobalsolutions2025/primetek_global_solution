import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getISTShiftDate } from '@/lib/utils';
import { closeStaleSessions } from '../attendance/actions';
import { getCachedPortalConfig } from '@/lib/cache/portal-config';
import EmployeeDashboardClient from './EmployeeDashboardClient';

export default async function EmployeeDashboardServerWrapper() {
  const session = await getSession();
  
  if (!session || !session.id) {
    redirect('/employee/login');
  }

  const todayStr = getISTShiftDate();

  await closeStaleSessions();

  // Fetch Employee, Attendance, Leave Balances, and portal config in parallel
  const [
    { data: employee },
    { data: records },
    { data: balances },
    configData
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
      .order('date', { ascending: false }),
    supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', session.id),
    getCachedPortalConfig()
  ]);

  const configMap = (configData || []).reduce((acc: Record<string, string>, curr: { config_key: string; config_value: string }) => {
    acc[curr.config_key] = curr.config_value;
    return acc;
  }, {});

  // Parse holidays_list
  let holidays = [];
  try {
    if (configMap['holidays_list']) {
      holidays = JSON.parse(configMap['holidays_list']);
    } else {
      holidays = [
        {
          id: 'independence-day-2025',
          title: 'Independence Day',
          date: '2025-08-15',
          type: 'Company Holiday'
        }
      ];
    }
  } catch (e) {
    console.error('Error parsing holidays_list:', e);
    holidays = [
      {
        id: 'independence-day-2025',
        title: 'Independence Day',
        date: '2025-08-15',
        type: 'Company Holiday'
      }
    ];
  }

  // Find today's attendance record
  const rawTodayRecord = records?.find((r) => r.date === todayStr);
  const todayRecordProp = rawTodayRecord ? {
    check_in: rawTodayRecord.check_in,
    check_out: rawTodayRecord.check_out,
    duration_hours: rawTodayRecord.check_in && rawTodayRecord.check_out
      ? (new Date(rawTodayRecord.check_out).getTime() - new Date(rawTodayRecord.check_in).getTime()) / (1000 * 60 * 60)
      : 0,
    status: rawTodayRecord.status || ''
  } : null;

  const totalRemainingLeaves = (balances || []).reduce((acc, curr) => acc + curr.remaining_days, 0);
  const isAdmin = session.role === 'admin' || session.role === 'hr';

  return (
    <EmployeeDashboardClient
      employee={employee}
      todayRecord={todayRecordProp}
      totalRemainingLeaves={totalRemainingLeaves}
      initialHolidays={holidays}
      isAdmin={isAdmin}
    />
  );
}
