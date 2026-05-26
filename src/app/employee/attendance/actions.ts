'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { assessAttendanceRisk } from '@/lib/security/risk-engine';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { calculateDistance } from '@/lib/utils';

// Helper to get current shift info based on 6:30 PM (18:30 IST) to 3:30 AM (03:30 IST) night shift
function getShiftInfo(now: Date = new Date()) {
  const offset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + offset);
  const hours = istNow.getUTCHours(); // Represents hour in IST
  
  let shiftDateStr: string;
  if (hours < 12) {
    // Before noon, the shift belongs to yesterday
    const yesterday = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
    shiftDateStr = yesterday.toISOString().split('T')[0];
  } else {
    // Noon or later, the shift belongs to today
    shiftDateStr = istNow.toISOString().split('T')[0];
  }
  
  // Shift start in UTC is 13:00 (18:30 IST) on shiftDateStr
  const [y, m, d] = shiftDateStr.split('-').map(Number);
  const shiftStart = new Date(Date.UTC(y, m - 1, d, 13, 0, 0));
  
  return {
    shiftDateStr,
    shiftStart,
    istNow,
  };
}

export async function closeStaleSessionsForEmployee(employeeId: string, currentShiftDateStr: string) {
  try {
    const { data: stale } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .is('check_out', null)
      .neq('date', currentShiftDateStr);

    if (stale && stale.length > 0) {
      for (const record of stale) {
        const checkInTime = new Date(record.check_in);
        const autoOut = new Date(checkInTime.getTime() + 9 * 60 * 60 * 1000);
        
        let totalBreak = record.total_break_seconds || 0;
        if (record.current_break_start) {
          const breakStart = new Date(record.current_break_start);
          const breakEnd = breakStart.getTime() < autoOut.getTime() ? autoOut : breakStart;
          const breakSeconds = Math.max(0, Math.floor((breakEnd.getTime() - breakStart.getTime()) / 1000));
          totalBreak += breakSeconds;
        }
        
        const totalSeconds = Math.max(0, Math.floor((autoOut.getTime() - checkInTime.getTime()) / 1000));
        const productiveSeconds = Math.max(0, totalSeconds - totalBreak);
        const productiveHours = Number((productiveSeconds / 3600).toFixed(2));
        const durationHours = Number((totalSeconds / 3600).toFixed(2));
        
        await supabaseAdmin
          .from('attendance')
          .update({ 
            check_out: autoOut.toISOString(),
            status: 'Logged Out',
            current_break_start: null,
            total_break_seconds: totalBreak,
            productive_hours: productiveHours,
            duration_hours: durationHours,
          })
          .eq('id', record.id);
      }
    }
  } catch (err) {
    console.error('Error closing stale sessions:', err);
  }
}

export async function checkIn(lat: number, lng: number, ipAddress?: string, userAgent?: string, deviceFingerprint?: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    const reqHeaders = await headers();
    const ip = ipAddress || reqHeaders.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = userAgent || reqHeaders.get('user-agent') || 'unknown';

    // Assess risk before proceeding
    const risk = await assessAttendanceRisk({
      userId: session.id,
      userRole: session.role ?? 'employee',
      ipAddress: ip,
      userAgent: ua,
      deviceFingerprint,
      latitude: lat,
      longitude: lng,
      action: 'check_in',
    });

    const { shiftDateStr, shiftStart } = getShiftInfo();

    // Close stale sessions (auto logout yesterday's sessions)
    await closeStaleSessionsForEmployee(session.id, shiftDateStr);

    if (risk && risk.level === 'high') {
      return { success: false, error: 'High risk attendance attempt detected', riskLevel: risk.level };
    }

    const { data: officeList } = await supabaseAdmin
      .from('office_locations')
      .select('name, lat, lng, radius_meters')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const office = officeList && officeList.length > 0 ? officeList[0] : null;

    const officeLat = Number(office?.lat || 17.3850);
    const officeLng = Number(office?.lng || 78.4867);
    const radius = Number(office?.radius_meters || 500);
    const officeName = office?.name || 'HQ';

    // 2. GPS Validation
    const distance = calculateDistance(lat, lng, officeLat, officeLng);
    
    if (distance > radius) {
      return { 
        success: false, 
        outOfRadius: true,
        distance: Math.round(distance),
        officeName
      };
    }

    // 3. Check for existing record
    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id, check_out, status')
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr)
      .maybeSingle();

    if (existing) {
      if (existing.check_out || existing.status === 'Logged Out') {
        return { success: false, error: 'Completed for today' };
      }
      return { success: false, error: `Already clocked in` };
    }

    // 4. Record Check-in & Calculate Lateness
    const now = new Date();
    // 6:45 PM IST is 13:15 UTC. Check-in is late if now >= shiftStart + 15 minutes
    const lateThreshold = new Date(shiftStart.getTime() + 15 * 60 * 1000);
    const isLate = now.getTime() >= lateThreshold.getTime();
    
    // Calculate late minutes relative to shift start (6:30 PM IST = 13:00 UTC)
    const lateMinutes = isLate 
      ? Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60)))
      : 0;

    const { data: attRecord, error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        employee_id: session.id,
        date: shiftDateStr,
        check_in: now.toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        status: 'Working',
        is_late: isLate,
        late_minutes: lateMinutes,
      }])
      .select('id')
      .single();

    if (error) throw error;

    if (risk && risk.riskEventId && attRecord) {
      await supabaseAdmin
        .from('attendance_risk_events')
        .update({ attendance_id: attRecord.id })
        .eq('id', risk.riskEventId);
    }

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return { success: false, error: errorMsg };
  }
}

export async function requestWFH(lat: number, lng: number, ipAddress?: string, userAgent?: string, deviceFingerprint?: string) {
  try {
    const reqHeaders = await headers();
    const ip = ipAddress || reqHeaders.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = userAgent || reqHeaders.get('user-agent') || 'unknown';
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    
    const risk = await assessAttendanceRisk({
      userId: session.id,
      userRole: session.role ?? 'employee',
      ipAddress: ip,
      userAgent: ua,
      deviceFingerprint,
      latitude: lat,
      longitude: lng,
      action: 'wfh_request',
    });
    
    if (risk && risk.level === 'high') {
      return { success: false, error: 'High risk WFH request', riskLevel: risk.level };
    }
    
    const { shiftDateStr, shiftStart } = getShiftInfo();

    // Close stale sessions (auto logout yesterday's sessions)
    await closeStaleSessionsForEmployee(session.id, shiftDateStr);

    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr)
      .maybeSingle();

    if (existing) return { success: false, error: 'Already exists for today' };

    // Record WFH request & Lateness
    const now = new Date();
    const lateThreshold = new Date(shiftStart.getTime() + 15 * 60 * 1000);
    const isLate = now.getTime() >= lateThreshold.getTime();
    const lateMinutes = isLate 
      ? Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60)))
      : 0;

    const { data: attRecord, error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        employee_id: session.id,
        date: shiftDateStr,
        check_in: now.toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        status: 'Pending WFH',
        is_late: isLate,
        late_minutes: lateMinutes,
      }])
      .select('id')
      .single();

    if (error) throw error;

    if (risk && risk.riskEventId && attRecord) {
      await supabaseAdmin
        .from('attendance_risk_events')
        .update({ attendance_id: attRecord.id })
        .eq('id', risk.riskEventId);
    }

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to request WFH' };
  }
}

export async function checkOut(recordId: string, lat: number, lng: number, ipAddress?: string, userAgent?: string, deviceFingerprint?: string) {
  try {
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return { success: false, error: 'Location access is required to check out.' };
    }
    const numLat = Number(lat);
    const numLng = Number(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return { success: false, error: 'Invalid location coordinates.' };
    }

    const reqHeaders = await headers();
    const ip = ipAddress || reqHeaders.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = userAgent || reqHeaders.get('user-agent') || 'unknown';
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    
    const risk = await assessAttendanceRisk({
      userId: session.id,
      userRole: session.role ?? 'employee',
      ipAddress: ip,
      userAgent: ua,
      deviceFingerprint,
      latitude: numLat,
      longitude: numLng,
      action: 'check_out',
    });
    
    if (risk && risk.level === 'high') {
      return { success: false, error: 'High risk check‑out attempt detected', riskLevel: risk.level };
    }

    // Fetch the check-in time to compute duration — enforce ownership to prevent IDOR
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', recordId)
      .eq('employee_id', session.id)
      .single();

    if (fetchError || !record || !record.check_in) {
      return { success: false, error: 'Attendance check-in record not found' };
    }

    // BIZ-04: Validate that record date matches today's shift date
    const { shiftDateStr } = getShiftInfo();
    if (record.date !== shiftDateStr) {
      return { success: false, error: 'Cannot check out of past attendance records.' };
    }


    const now = new Date();
    
    // Automatically close break if checked out while on break
    let totalBreak = record.total_break_seconds || 0;
    if (record.current_break_start) {
      const breakStart = new Date(record.current_break_start);
      const breakSeconds = Math.max(0, Math.floor((now.getTime() - breakStart.getTime()) / 1000));
      totalBreak += breakSeconds;
    }

    const checkInTime = new Date(record.check_in).getTime();
    const totalSeconds = Math.max(0, Math.floor((now.getTime() - checkInTime) / 1000));
    const productiveSeconds = Math.max(0, totalSeconds - totalBreak);
    
    const productiveHours = Number((productiveSeconds / 3600).toFixed(2));
    const durationHours = Number((totalSeconds / 3600).toFixed(2));

    const { data: attRecord, error } = await supabaseAdmin
      .from('attendance')
      .update({
        check_out: now.toISOString(),
        duration_hours: durationHours,
        status: 'Logged Out',
        current_break_start: null,
        total_break_seconds: totalBreak,
        productive_hours: productiveHours,
        lat: numLat,
        lng: numLng,
      })
      .eq('id', recordId)
      .eq('employee_id', session.id)
      .select('id')
      .single();

    if (error) throw error;

    if (risk && risk.riskEventId && attRecord) {
      await supabaseAdmin
        .from('attendance_risk_events')
        .update({ attendance_id: attRecord.id })
        .eq('id', risk.riskEventId);
    }

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return { success: false, error: errorMsg };
  }
}

export async function resumeSession(recordId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const { shiftDateStr } = getShiftInfo();

    // Fetch the checkout record first to check the time guard
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('check_out')
      .eq('id', recordId)
      .eq('employee_id', session.id)
      .single();

    if (fetchError || !record || !record.check_out) {
      return { success: false, error: 'Checkout record not found' };
    }

    const checkoutTime = new Date(record.check_out);
    const now = new Date();
    const minutesSinceCheckout = (now.getTime() - checkoutTime.getTime()) / (1000 * 60);

    if (minutesSinceCheckout > 15) {
      return { success: false, error: 'Resume window (15 minutes) has expired' };
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ 
        check_out: null,
        status: 'Working'
      })
      .eq('id', recordId)
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr); // Only allow resuming today's record

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to resume session';
    return { success: false, error: errorMsg };
  }
}


export async function startBreak() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const { shiftDateStr } = getShiftInfo();

    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr)
      .is('check_out', null)
      .maybeSingle();

    if (fetchError || !record) {
      return { success: false, error: 'No active attendance record found for today.' };
    }

    if (record.status !== 'Working') {
      return { success: false, error: `Cannot start break from status: ${record.status}` };
    }

    const now = new Date();
    const { error } = await supabaseAdmin
      .from('attendance')
      .update({
        status: 'On Break',
        current_break_start: now.toISOString()
      })
      .eq('id', record.id);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return { success: false, error: errorMsg };
  }
}

export async function endBreak() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const { shiftDateStr } = getShiftInfo();

    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr)
      .is('check_out', null)
      .maybeSingle();

    if (fetchError || !record) {
      return { success: false, error: 'No active attendance record found for today.' };
    }

    if (record.status !== 'On Break' || !record.current_break_start) {
      return { success: false, error: 'You are not currently on a break.' };
    }

    const now = new Date();
    const breakStart = new Date(record.current_break_start);
    const breakSeconds = Math.max(0, Math.floor((now.getTime() - breakStart.getTime()) / 1000));
    const newTotalBreak = (record.total_break_seconds || 0) + breakSeconds;

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({
        status: 'Working',
        current_break_start: null,
        total_break_seconds: newTotalBreak
      })
      .eq('id', record.id);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return { success: false, error: errorMsg };
  }
}

export async function getLateLoginsStats() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { lateCount: 0, deduction: 0.0, warningMessage: '', remainingSafeCount: 3 };

    const offset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + offset);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth() + 1; // 1-12

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const endOfMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data: records, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', session.id)
      .eq('is_late', true)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth)
      .eq('late_approved', false)
      .eq('permission_approved', false)
      .eq('shift_override', false)
      .eq('manager_exemption', false);

    if (error) throw error;

    // Filter out approved WFH
    const unexemptedLates = (records || []).filter(r => r.status !== 'Approved WFH');
    const lateCount = unexemptedLates.length;

    let deduction = 0.0;
    let warningMessage = '';
    let remainingSafeCount = 0;

    if (lateCount < 3) {
      remainingSafeCount = 3 - lateCount;
      warningMessage = `${remainingSafeCount} more late login${remainingSafeCount > 1 ? 's' : ''} will deduct Half Day attendance.`;
      deduction = 0.0;
    } else if (lateCount < 6) {
      remainingSafeCount = 6 - lateCount;
      warningMessage = `${remainingSafeCount} more late login${remainingSafeCount > 1 ? 's' : ''} will deduct a Full Day attendance.`;
      deduction = 0.5;
    } else {
      remainingSafeCount = 0;
      warningMessage = 'Full Day attendance deduction has been applied.';
      deduction = 1.0;
    }

    return {
      lateCount,
      deduction,
      warningMessage,
      remainingSafeCount
    };
  } catch (err) {
    console.error('Error fetching late login stats:', err);
    return { lateCount: 0, deduction: 0.0, warningMessage: '', remainingSafeCount: 3 };
  }
}
