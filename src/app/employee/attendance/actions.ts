'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveSession } from '@/lib/auth';
import { assessAttendanceRisk } from '@/lib/security/risk-engine';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { calculateDistance, getISTShiftDate } from '@/lib/utils';
import { getCachedActiveOfficeLocation } from '@/lib/cache/office-location';

function getShiftInfo(now: Date = new Date()) {
  const shiftDateStr = getISTShiftDate(now);
  const offset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + offset);
  
  // Shift start in UTC is 13:00 (18:30 IST) on shiftDateStr
  const [y, m, d] = shiftDateStr.split('-').map(Number);
  const shiftStart = new Date(Date.UTC(y, m - 1, d, 13, 0, 0));
  
  return {
    shiftDateStr,
    shiftStart,
    istNow,
  };
}

export async function closeStaleSessions() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');
  await verifyActiveSession(session.id);
  const currentShiftDate = getISTShiftDate();
  await closeStaleSessionsForEmployee(session.id, currentShiftDate, true);
}

async function closeStaleSessionsForEmployee(employeeId: string, currentShiftDateStr: string, skipRevalidate = false) {
  try {
    const { error } = await supabaseAdmin.rpc('sweep_stale_sessions_for_employee', {
      p_employee_id: employeeId,
      p_current_shift_date: currentShiftDateStr
    });

    if (error) {
      console.error('RPC sweep_stale_sessions_for_employee failed:', error.message);
    } else if (!skipRevalidate) {
      revalidatePath('/employee/attendance');
      revalidatePath('/employee/dashboard');
      revalidatePath('/admin/attendance');
    }
  } catch (err) {
    console.error('Error closing stale sessions:', err);
  }
}

export async function checkIn(
  lat: number,
  lng: number,
  ipAddress?: string,
  userAgent?: string,
  deviceFingerprint?: string,
  clientTimestamp?: string,
  deviceInfo?: { deviceType: string; deviceLabel: string },
  tabId?: string,
  isOfflineSync?: boolean
) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveSession(session.id);
    const serverNow = new Date();
    let shiftDateRef = serverNow; // Used only for shift date calculation
    if (clientTimestamp) {
      const parsedTime = new Date(clientTimestamp);
      const diff = parsedTime.getTime() - serverNow.getTime();
      // Reject timestamps more than 60 seconds in the future
      if (diff > 60 * 1000) {
        throw new Error('Future timestamp detected. Anti-tampering block triggered.');
      }

      if (isOfflineSync) {
        // For offline sync, allow up to 72 hours (TTL) historical inserts
        if (diff < -72 * 60 * 60 * 1000) {
          throw new Error('Stale offline sync timestamp detected (exceeds 72h TTL).');
        }
      } else {
        // Reject timestamps more than 10 minutes in the past for live attempts
        if (diff < -10 * 60 * 1000) {
          throw new Error('Stale timestamp detected. Anti-tampering block triggered.');
        }

        // Check if client timestamp matches server shift date
        const { shiftDateStr: serverShiftDate } = getShiftInfo();
        const { shiftDateStr: clientShiftDate } = getShiftInfo(parsedTime);
        if (clientShiftDate !== serverShiftDate) {
          throw new Error('Timestamp shift date mismatch.');
        }
      }
      
      shiftDateRef = parsedTime; // Only used for shift date detection
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

    const { shiftDateStr, shiftStart } = getShiftInfo(shiftDateRef);

    // Check if WFH is active for this employee on today's shift date (pre-approved or global override)
    let isWFHActive = false;
    try {
      const { data: wfhData, error: wfhError } = await supabaseAdmin.rpc('check_active_wfh', {
        p_employee_id: session.id,
        p_date: shiftDateStr
      });
      if (!wfhError && wfhData !== null) {
        isWFHActive = !!wfhData;
      }
    } catch (err) {
      console.error('Error checking active WFH status in checkIn:', err);
    }

    // Close stale sessions (auto logout yesterday's sessions)
    await closeStaleSessionsForEmployee(session.id, shiftDateStr);

    if (risk && risk.level === 'high') {
      return { success: false, error: 'High risk attendance attempt detected', riskLevel: risk.level };
    }

    const office = await getCachedActiveOfficeLocation();

    const officeLat = Number(office?.lat || 17.3850);
    const officeLng = Number(office?.lng || 78.4867);
    const radius = Number(office?.radius_meters || 500);
    const officeName = office?.name || 'HQ';

    // 2. GPS Validation
    const distance = calculateDistance(lat, lng, officeLat, officeLng);
    
    if (distance > radius && !isWFHActive) {
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
        // Query the latest event to check if it was a system forced logout
        const { data: lastEvent } = await supabaseAdmin
          .from('attendance_events')
          .select('event_type')
          .eq('session_id', existing.id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const isSystemForced = lastEvent?.event_type === 'FORCE_LOGOUT';
        let canResume = isSystemForced;

        if (!canResume && existing.check_out) {
          const checkoutTime = new Date(existing.check_out);
          const minutesSinceCheckout = (serverNow.getTime() - checkoutTime.getTime()) / (1000 * 60);
          if (minutesSinceCheckout <= 15) {
            canResume = true;
          }
        }

        if (canResume) {
          const resumeResult = await resumeSession(existing.id);
          if (resumeResult.success) {
            return { success: true, recordId: existing.id, resumed: true };
          } else {
            return { success: false, error: resumeResult.error || 'Failed to resume session' };
          }
        }

        return { success: false, error: 'Completed for today' };
      }
      return { success: false, error: `Already clocked in` };
    }

    // 4. Record Check-in & Calculate Lateness
    // 6:45 PM IST is 13:15 UTC. Check-in is late if check-in time >= shiftStart + 15 minutes
    const lateThreshold = new Date(shiftStart.getTime() + 15 * 60 * 1000);
    const checkInTime = clientTimestamp ? new Date(clientTimestamp) : serverNow;
    
    // Security Fix: Lateness must always be calculated using the server time (serverNow) for live check-ins
    // to prevent client-side time-tampering. For offline syncs, we use the client-reported sync time.
    const latenessReferenceTime = isOfflineSync ? checkInTime : serverNow;
    const isLate = latenessReferenceTime.getTime() >= lateThreshold.getTime();
    
    // Calculate late minutes relative to shift start (6:30 PM IST = 13:00 UTC)
    const lateMinutes = isLate 
      ? Math.max(0, Math.floor((latenessReferenceTime.getTime() - shiftStart.getTime()) / (1000 * 60)))
      : 0;

    const isMobile = deviceInfo?.deviceType === 'mobile' || deviceInfo?.deviceType === 'tablet';
    const initialStatus = isWFHActive ? 'Approved WFH' : 'Working';

    const { data: attRecord, error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        employee_id: session.id,
        date: shiftDateStr,
        check_in: checkInTime.toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        status: initialStatus,
        is_late: isLate,
        late_minutes: lateMinutes,
        device_type: deviceInfo?.deviceType || 'desktop',
        device_label: deviceInfo?.deviceLabel || 'Desktop',
        active_device_fingerprint: deviceFingerprint || null,
        active_tab_id: tabId || null,
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

    const eventType = isMobile ? 'MOBILE_CLOCK_IN' : 'CLOCK_IN';

    // Insert CLOCK_IN or MOBILE_CLOCK_IN event
    await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: attRecord.id,
        employee_id: session.id,
        event_type: eventType,
        event_timestamp: checkInTime.toISOString(),
        sequence_number: 1,
        idempotency_key: `clk-in-${attRecord.id}`,
        client_ip: ip === 'unknown' ? '0.0.0.0' : ip,
        gps_lat: Number(lat),
        gps_lng: Number(lng),
        gps_accuracy: 10,
        payload: { 
          is_late: isLate, 
          late_minutes: lateMinutes,
          device_type: deviceInfo?.deviceType || 'desktop',
          device_label: deviceInfo?.deviceLabel || 'Desktop',
          is_pre_approved_wfh: isWFHActive
        }
      }]);

    if (isWFHActive) {
      await supabaseAdmin
        .from('attendance_events')
        .insert([{
          session_id: attRecord.id,
          employee_id: session.id,
          event_type: 'ADMIN_OVERRIDE',
          event_timestamp: checkInTime.toISOString(),
          sequence_number: 2,
          idempotency_key: `wfh-override-${attRecord.id}`,
          client_ip: ip === 'unknown' ? '0.0.0.0' : ip,
          gps_lat: Number(lat),
          gps_lng: Number(lng),
          gps_accuracy: 10,
          payload: {
            override_field: 'status',
            new_value: 'Approved WFH',
            reason: 'Auto-applied pre-approved WFH / Global WFH override'
          }
        }]);
    }

    // Rebuild projection so admin live monitor reflects the new check-in immediately
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: attRecord.id
    });

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
    return { success: true, recordId: attRecord.id, isWFHActive };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return { success: false, error: errorMsg };
  }
}

export async function requestWFH(
  lat: number,
  lng: number,
  ipAddress?: string,
  userAgent?: string,
  deviceFingerprint?: string,
  clientTimestamp?: string,
  isOfflineSync?: boolean
) {
  try {
    const reqHeaders = await headers();
    const ip = ipAddress || reqHeaders.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = userAgent || reqHeaders.get('user-agent') || 'unknown';
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const serverNow = new Date();
    let shiftDateRef = serverNow; // Used only for shift date calculation
    if (clientTimestamp) {
      const parsedTime = new Date(clientTimestamp);
      const diff = parsedTime.getTime() - serverNow.getTime();
      // Reject timestamps more than 60 seconds in the future
      if (diff > 60 * 1000) {
        throw new Error('Future timestamp detected. Anti-tampering block triggered.');
      }

      if (isOfflineSync) {
        // For offline sync, allow up to 72 hours (TTL) historical inserts
        if (diff < -72 * 60 * 60 * 1000) {
          throw new Error('Stale offline sync timestamp detected (exceeds 72h TTL).');
        }
      } else {
        // Reject timestamps more than 10 minutes in the past for live attempts
        if (diff < -10 * 60 * 1000) {
          throw new Error('Stale timestamp detected. Anti-tampering block triggered.');
        }

        // Check if client timestamp matches server shift date
        const { shiftDateStr: serverShiftDate } = getShiftInfo();
        const { shiftDateStr: clientShiftDate } = getShiftInfo(parsedTime);
        if (clientShiftDate !== serverShiftDate) {
          throw new Error('Timestamp shift date mismatch.');
        }
      }
      
      shiftDateRef = parsedTime; // Only used for shift date detection
    }
    
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
    
    const { shiftDateStr, shiftStart } = getShiftInfo(shiftDateRef);

    // Check if WFH is active for this employee on today's shift date (pre-approved or global override)
    let isWFHActive = false;
    try {
      const { data: wfhData, error: wfhError } = await supabaseAdmin.rpc('check_active_wfh', {
        p_employee_id: session.id,
        p_date: shiftDateStr
      });
      if (!wfhError && wfhData !== null) {
        isWFHActive = !!wfhData;
      }
    } catch (err) {
      console.error('Error checking active WFH status in requestWFH:', err);
    }

    // Close stale sessions (auto logout yesterday's sessions)
    await closeStaleSessionsForEmployee(session.id, shiftDateStr);

    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id, check_out, status')
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr)
      .maybeSingle();

    if (existing) {
      if (existing.check_out || existing.status === 'Logged Out') {
        const { data: lastEvent } = await supabaseAdmin
          .from('attendance_events')
          .select('event_type')
          .eq('session_id', existing.id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const isSystemForced = lastEvent?.event_type === 'FORCE_LOGOUT';
        let canResume = isSystemForced;

        if (!canResume && existing.check_out) {
          const checkoutTime = new Date(existing.check_out);
          const minutesSinceCheckout = (serverNow.getTime() - checkoutTime.getTime()) / (1000 * 60);
          if (minutesSinceCheckout <= 15) {
            canResume = true;
          }
        }

        if (canResume) {
          const resumeResult = await resumeSession(existing.id);
          if (resumeResult.success) {
            return { success: true, recordId: existing.id, resumed: true };
          } else {
            return { success: false, error: resumeResult.error || 'Failed to resume session' };
          }
        }
      }
      return { success: false, error: 'Already exists for today' };
    }

    // Record WFH request & Lateness
    const lateThreshold = new Date(shiftStart.getTime() + 15 * 60 * 1000);
    const checkInTime = clientTimestamp ? new Date(clientTimestamp) : serverNow;
    const isLate = checkInTime.getTime() >= lateThreshold.getTime();
    const lateMinutes = isLate 
      ? Math.max(0, Math.floor((checkInTime.getTime() - shiftStart.getTime()) / (1000 * 60)))
      : 0;

    const initialStatus = isWFHActive ? 'Approved WFH' : 'Pending WFH';

    const { data: attRecord, error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        employee_id: session.id,
        date: shiftDateStr,
        check_in: checkInTime.toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        status: initialStatus,
        is_late: isLate,
        late_minutes: lateMinutes,
      }])
      .select('id')
      .single();

    if (error) throw error;

    const isMobile = /mobile|tablet|android|iphone|ipad/i.test(ua);
    const eventType = isMobile ? 'MOBILE_CLOCK_IN' : 'CLOCK_IN';

    // Insert CLOCK_IN or MOBILE_CLOCK_IN event for WFH session tracking
    await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: attRecord.id,
        employee_id: session.id,
        event_type: eventType,
        event_timestamp: checkInTime.toISOString(),
        sequence_number: 1,
        idempotency_key: `wfh-clk-in-${attRecord.id}`,
        client_ip: ip === 'unknown' ? '0.0.0.0' : ip,
        gps_lat: Number(lat),
        gps_lng: Number(lng),
        gps_accuracy: 10,
        payload: { 
          is_late: isLate, 
          late_minutes: lateMinutes,
          device_type: isMobile ? 'mobile' : 'desktop',
          device_label: isMobile ? 'Mobile' : 'Desktop',
          is_wfh_request: !isWFHActive,
          is_pre_approved_wfh: isWFHActive
        }
      }]);

    // Rebuild projection so it initializes correctly and is fetchable by client check
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: attRecord.id
    });

    // Trigger notification to admin if WFH is NOT pre-approved
    if (!isWFHActive) {
      try {
        const { data: employee } = await supabaseAdmin
          .from('employees')
          .select('name')
          .eq('id', session.id)
          .single();
        const employeeName = employee?.name || 'An employee';

        const { getAdminWFHRequestTemplate, notifyAdminsIfEnabled } = await import('@/lib/notifications');
        const html = getAdminWFHRequestTemplate(employeeName, shiftDateStr);
        await notifyAdminsIfEnabled('notif_wfh', `New WFH Request - ${employeeName}`, html);

        // Web Push notification to admins
        try {
          const { data: admins } = await supabaseAdmin.from('admin_users').select('id');
          if (admins && admins.length > 0) {
            for (const admin of admins) {
              await dispatchNotification({
                title: `New WFH Request`,
                message: `${employeeName} requested WFH for ${shiftDateStr}.`,
                type: 'leave_approval_required',
                adminId: admin.id,
                clickActionUrl: '/admin/approvals'
              });
            }
          }
        } catch (pushErr: any) {
          console.warn(`[Push Delivery Failed] action: clockInWFH, error: ${pushErr.message}`);
        }
      } catch (notifErr) {
        console.error('Failed to send WFH notification:', notifErr);
      }
    }

    if (risk && risk.riskEventId && attRecord) {
      await supabaseAdmin
        .from('attendance_risk_events')
        .update({ attendance_id: attRecord.id })
        .eq('id', risk.riskEventId);
    }

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
    return { success: true, recordId: attRecord.id, isWFHActive };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to request WFH';
    return { success: false, error: errorMsg };
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

    if (record.check_out || record.status === 'Logged Out') {
      return { success: false, error: 'You are already clocked out.' };
    }

    // BIZ-04: Validate that the record is from the current shift or yesterday's shift (overnight check-out)
    const { shiftDateStr } = getShiftInfo();
    const timeSinceCheckIn = Date.now() - new Date(record.check_in).getTime();
    const isPastShift = record.date !== shiftDateStr;
    
    if (isPastShift) {
      // Allow overnight check-out if checked in within the last 16 hours
      const isOvernightValid = timeSinceCheckIn < 16 * 60 * 60 * 1000;
      if (!isOvernightValid) {
        return { success: false, error: 'Cannot check out of past attendance records.' };
      }
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

    if (risk && risk.riskEventId) {
      await supabaseAdmin
        .from('attendance_risk_events')
        .update({ attendance_id: recordId })
        .eq('id', risk.riskEventId);
    }

    // Fetch the last sequence number from events to determine the sequence number for CLOCK_OUT
    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', recordId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    const nextSequence = (lastEvent?.sequence_number || 1) + 1;

    // Insert CLOCK_OUT event
    await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: recordId,
        employee_id: session.id,
        event_type: 'CLOCK_OUT',
        sequence_number: nextSequence,
        idempotency_key: `clk-out-${recordId}-${nextSequence}`,
        client_ip: ip === 'unknown' ? '0.0.0.0' : ip,
        gps_lat: numLat,
        gps_lng: numLng,
        gps_accuracy: 10,
        payload: { duration_hours: durationHours, total_break_seconds: totalBreak, productive_hours: productiveHours }
      }]);

    // Rebuild projection so admin live monitor reflects the check-out immediately
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: recordId
    });

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
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

    // Fetch the checkout record first with coordinates
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('date, check_out, lat, lng')
      .eq('id', recordId)
      .eq('employee_id', session.id)
      .single();

    if (fetchError || !record || !record.check_out) {
      return { success: false, error: 'Checkout record not found' };
    }

    if (record.date !== shiftDateStr) {
      return { success: false, error: 'Only today\'s session can be resumed' };
    }

    // Check if the session was auto-logged out by system sweeper
    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('event_type')
      .eq('session_id', recordId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isSystemForced = lastEvent?.event_type === 'FORCE_LOGOUT';

    if (!isSystemForced) {
      const checkoutTime = new Date(record.check_out);
      const now = new Date();
      const minutesSinceCheckout = (now.getTime() - checkoutTime.getTime()) / (1000 * 60);

      if (minutesSinceCheckout > 15) {
        return { success: false, error: 'Resume window (15 minutes) has expired' };
      }
    }

    // Determine if session is remote (WFH)
    const office = await getCachedActiveOfficeLocation();
    const officeLat = Number(office?.lat || 17.3850);
    const officeLng = Number(office?.lng || 78.4867);
    const radius = Number(office?.radius_meters || 500);

    const isRemote = record.lat && record.lng 
      ? calculateDistance(Number(record.lat), Number(record.lng), officeLat, officeLng) > radius 
      : false;

    const restoredStatus = isRemote ? 'Approved WFH' : 'Working';
    const now = new Date();

    // Append SESSION_RECOVERED event to keep the event stream consistent (no direct update to attendance)
    const { data: lastEventRec } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', recordId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (lastEventRec?.sequence_number || 1) + 1;
    await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: recordId,
        employee_id: session.id,
        event_type: 'SESSION_RECOVERED',
        sequence_number: nextSequence,
        idempotency_key: `resume-${recordId}-${nextSequence}`,
        client_ip: '0.0.0.0',
        payload: { resumed_at: now.toISOString(), status: restoredStatus }
      }]);

    // Rebuild projection so admin live monitor reflects the resumed session immediately
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: recordId
    });

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
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

    if (record.status !== 'Working' && record.status !== 'Approved WFH') {
      return { success: false, error: `Cannot start break from status: ${record.status}` };
    }

    const now = new Date();

    // Get sequence number first
    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', record.id)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (lastEvent?.sequence_number || 1) + 1;

    // Insert BREAK_STARTED event — projection rebuild will apply the status change.
    // Do NOT directly update the attendance row here; the rebuild is the single source of truth.
    const { error: insertError } = await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: record.id,
        employee_id: session.id,
        event_type: 'BREAK_STARTED',
        sequence_number: nextSequence,
        idempotency_key: `brk-start-${record.id}-${nextSequence}`,
        client_ip: '0.0.0.0',
        gps_lat: record.lat ? Number(record.lat) : null,
        gps_lng: record.lng ? Number(record.lng) : null,
        gps_accuracy: 10,
        payload: { start_time: now.toISOString() }
      }]);

    if (insertError) throw insertError;

    // Rebuild projection — this applies the BREAK_STARTED event and updates status + current_break_start
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: record.id
    });

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
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

    if (record.status !== 'Break' || !record.current_break_start) {
      return { success: false, error: 'You are not currently on a break.' };
    }

    const now = new Date();
    const breakStart = new Date(record.current_break_start);
    const breakSeconds = Math.max(0, Math.floor((now.getTime() - breakStart.getTime()) / 1000));
    const newTotalBreak = (record.total_break_seconds || 0) + breakSeconds;

    const office = await getCachedActiveOfficeLocation();
    const officeLat = Number(office?.lat || 17.3850);
    const officeLng = Number(office?.lng || 78.4867);
    const radius = Number(office?.radius_meters || 500);

    const isRemote = record.lat && record.lng 
      ? calculateDistance(Number(record.lat), Number(record.lng), officeLat, officeLng) > radius 
      : false;
    const nextStatus = isRemote ? 'Approved WFH' : 'Working';

    // Get sequence number first
    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', record.id)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (lastEvent?.sequence_number || 1) + 1;

    // Insert BREAK_ENDED event — projection rebuild will apply the status change and accumulate break seconds.
    // Do NOT directly update the attendance row here; the rebuild is the single source of truth.
    const { error: insertError } = await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: record.id,
        employee_id: session.id,
        event_type: 'BREAK_ENDED',
        sequence_number: nextSequence,
        idempotency_key: `brk-end-${record.id}-${nextSequence}`,
        client_ip: '0.0.0.0',
        gps_lat: record.lat ? Number(record.lat) : null,
        gps_lng: record.lng ? Number(record.lng) : null,
        gps_accuracy: 10,
        payload: { end_time: now.toISOString(), total_break_seconds: newTotalBreak, next_status: nextStatus }
      }]);

    if (insertError) throw insertError;

    // Rebuild projection — this applies the BREAK_ENDED event and updates status + total_break_seconds
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: record.id
    });

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
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

    const todayIST = getISTShiftDate(new Date());
    const [year, month] = todayIST.split('-').map(Number);

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

export async function checkGeofence(lat: number, lng: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const office = await getCachedActiveOfficeLocation();
    if (!office) return { success: true, withinRange: true }; // default to true if no office set

    const officeLat = Number(office.lat);
    const officeLng = Number(office.lng);
    const radius = Number(office.radius_meters || 500);

    const distance = calculateDistance(lat, lng, officeLat, officeLng);
    return {
      success: true,
      withinRange: distance <= radius,
      distance: Math.round(distance),
      radius
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to verify geofence';
    return { success: false, error: errorMsg };
  }
}

export async function processHeartbeat(payload: {
  sessionId: string;
  sequenceNumber: number;
  clientTimestamp: string;
  idempotencyKey: string;
  activeWindow: boolean;
  meetingMode: boolean;
  deviceType?: string;
  deviceLabel?: string;
  deviceFingerprint?: string;
  tabId?: string;
  telemetry: {
    clicks: number;
    keypresses: number;
    pointerMoves: number;
    lat: number;
    lng: number;
    accuracy: number;
  };
}) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const reqHeaders = await headers();
    const clientIp = reqHeaders.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // 1. Fetch current active session parameters
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', payload.sessionId)
      .eq('employee_id', session.id)
      .single();

    if (fetchError || !record) {
      return { success: false, error: 'Session not found' };
    }

    if (record.check_out || record.status === 'Logged Out') {
      return { success: false, error: 'Session is already clocked out' };
    }

    // Single active session check (device fingerprint mismatch)
    if (payload.deviceFingerprint && record.active_device_fingerprint && record.active_device_fingerprint !== payload.deviceFingerprint) {
      return { success: false, error: 'Session active on another device' };
    }

    // Auto-update active identifiers on first heartbeat if missing
    if (payload.deviceFingerprint && !record.active_device_fingerprint) {
      await supabaseAdmin
        .from('attendance')
        .update({
          active_device_fingerprint: payload.deviceFingerprint,
          active_tab_id: payload.tabId || null,
          device_type: payload.deviceType || record.device_type,
          device_label: payload.deviceLabel || record.device_label
        })
        .eq('id', record.id);
    } else if (payload.deviceType && record.device_type !== payload.deviceType) {
      // Sync device type / label if they differ on subsequent heartbeats
      await supabaseAdmin
        .from('attendance')
        .update({
          device_type: payload.deviceType,
          device_label: payload.deviceLabel || record.device_label
        })
        .eq('id', record.id);
    }

    // 2. Perform Geofencing Verification (Drift-tolerant check)
    const office = await getCachedActiveOfficeLocation();
    const officeLat = Number(office?.lat || 17.3850);
    const officeLng = Number(office?.lng || 78.4867);
    const radius = Number(office?.radius_meters || 500);

    const distance = calculateDistance(payload.telemetry.lat, payload.telemetry.lng, officeLat, officeLng);
    const withinRange = distance <= (radius + payload.telemetry.accuracy * 0.1);

    const resolvedEventType: 'HEARTBEAT_RECEIVED' | 'AUTO_BREAK_TRIGGERED' = 'HEARTBEAT_RECEIVED';
    const nextStatus = record.status;

    // 3. Write transactionally to DB using RPC write_heartbeat_event
    const { error: rpcErr } = await supabaseAdmin.rpc('write_heartbeat_event', {
      p_session_id: payload.sessionId,
      p_employee_id: session.id,
      p_event_type: resolvedEventType,
      p_sequence: payload.sequenceNumber,
      p_idempotency: payload.idempotencyKey,
      p_client_ip: clientIp,
      p_lat: Number(payload.telemetry.lat),
      p_lng: Number(payload.telemetry.lng),
      p_accuracy: Number(payload.telemetry.accuracy),
      p_status: nextStatus,
      p_payload: {
        active_window: payload.activeWindow,
        meeting_mode: payload.meetingMode,
        clicks: payload.telemetry.clicks,
        keypresses: payload.telemetry.keypresses,
        pointer_moves: payload.telemetry.pointerMoves,
        distance_meters: Math.round(distance),
        device_type: payload.deviceType || 'desktop',
        device_label: payload.deviceLabel || 'Desktop'
      }
    });

    if (rpcErr) {
      console.error('[Heartbeat RPC Error]:', rpcErr);
      return { success: false, error: 'Database transaction sync error' };
    }

    return { 
      success: true, 
      status: nextStatus,
      withinRange,
      distance: Math.round(distance)
    };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return { success: false, error: errorMsg };
  }
}

export async function moveActiveSession(
  sessionId: string, 
  newFingerprint: string, 
  tabId: string,
  newDeviceType?: string,
  newDeviceLabel?: string
) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({
        active_device_fingerprint: newFingerprint,
        active_tab_id: tabId,
        device_type: newDeviceType || 'desktop',
        device_label: newDeviceLabel || 'Desktop'
      })
      .eq('id', sessionId)
      .eq('employee_id', session.id);

    if (error) throw error;
    
    // Also append an event indicating session was moved/hijacked
    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (lastEvent?.sequence_number || 1) + 1;
    await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: sessionId,
        employee_id: session.id,
        event_type: 'SESSION_RECOVERED',
        sequence_number: nextSequence,
        idempotency_key: `move-${sessionId}-${nextSequence}`,
        client_ip: '0.0.0.0',
        payload: { 
          moved_to_fingerprint: newFingerprint, 
          tab_id: tabId,
          device_type: newDeviceType || 'desktop',
          device_label: newDeviceLabel || 'Desktop'
        }
      }]);

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Internal error' };
  }
}

export async function rebuildSession(sessionId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    // Verify session ownership to prevent BOLA
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('employee_id')
      .eq('id', sessionId)
      .single();

    if (fetchError || !record) {
      return { success: false, error: 'Session not found' };
    }

    if (record.employee_id !== session.id) {
      return { success: false, error: 'Unauthorized: Session does not belong to the current user' };
    }

    const { error } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: sessionId
    });

    if (error) throw error;
    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to rebuild session projection';
    return { success: false, error: errorMsg };
  }
}

export async function getAttendanceSessionState(sessionId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Fetch record
    const { data: att, error: attErr } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', sessionId)
      .eq('employee_id', session.id)
      .maybeSingle();

    if (attErr) throw attErr;
    if (!att) return { success: false, error: 'Session not found' };

    const { data: projection, error: projErr } = await supabaseAdmin
      .from('attendance_projections')
      .select('*')
      .eq('session_id', sessionId)
      .eq('employee_id', session.id)
      .maybeSingle();

    if (projErr) throw projErr;

    return {
      success: true,
      projection,
      attendance: att
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function getActiveSessionForToday() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const { shiftDateStr } = getShiftInfo();
    const { data: record, error } = await supabaseAdmin
      .from('attendance')
      .select('id, status, check_in, check_out, active_device_fingerprint, active_tab_id, device_type, device_label')
      .eq('employee_id', session.id)
      .eq('date', shiftDateStr)
      .maybeSingle();
    if (error) throw error;
    return { success: true, record };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function hasPendingClockOutRequestForToday() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, pending: false };
    const { data, error } = await supabaseAdmin
      .from('attendance_recovery_queue')
      .select('id')
      .eq('employee_id', session.id)
      .eq('action', 'check_out')
      .eq('status', 'PENDING')
      .maybeSingle();
    if (error) throw error;
    return { success: true, pending: !!data };
  } catch (err) {
    return { success: false, pending: false };
  }
}

export async function logStatusTransitionEvent(sessionId: string, newStatus: 'Working' | 'Idle' | 'Break (Auto)') {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    // Fetch the current record first
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', sessionId)
      .eq('employee_id', session.id)
      .single();

    if (fetchError || !record) {
      return { success: false, error: 'Session not found' };
    }

    if (record.check_out || record.status === 'Logged Out') {
      return { success: false, error: 'Session is already clocked out' };
    }

    let eventType: string;
    if (newStatus === 'Working') {
      eventType = 'PRODUCTIVE_TIMER_RESUMED';
    } else if (newStatus === 'Idle') {
      eventType = 'IDLE_DETECTED';
    } else if (newStatus === 'Break (Auto)') {
      eventType = 'AUTO_BREAK_TRIGGERED';
    } else {
      return { success: false, error: 'Invalid transition status' };
    }

    // Check if the status is already what we want, to avoid duplicate events
    if (record.status === newStatus) {
      return { success: true };
    }

    const now = new Date();
    
    // Get next sequence number
    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (lastEvent?.sequence_number || 1) + 1;

    // Insert the transition event
    const { error: insertErr } = await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: sessionId,
        employee_id: session.id,
        event_type: eventType,
        sequence_number: nextSequence,
        idempotency_key: `transition-${sessionId}-${eventType}-${nextSequence}`,
        client_ip: '0.0.0.0',
        gps_lat: record.lat ? Number(record.lat) : null,
        gps_lng: record.lng ? Number(record.lng) : null,
        gps_accuracy: 10,
        payload: { transition_time: now.toISOString(), previous_status: record.status }
      }]);

    if (insertErr) throw insertErr;

    // Rebuild projection so admin live monitor reflects the status transition immediately
    await supabaseAdmin.rpc('rebuild_attendance_projection', {
      p_session_id: sessionId
    });

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    revalidatePath('/admin/attendance');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to log transition' };
  }
}

export async function logGPSDismissEvent(sessionId: string, lat: number, lng: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    // Verify session ownership to prevent BOLA
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('employee_id')
      .eq('id', sessionId)
      .single();

    if (fetchError || !record) {
      return { success: false, error: 'Session not found' };
    }

    if (record.employee_id !== session.id) {
      return { success: false, error: 'Unauthorized: Session does not belong to the current user' };
    }

    const { data: lastEvent } = await supabaseAdmin
      .from('attendance_events')
      .select('sequence_number')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (lastEvent?.sequence_number || 1) + 1;

    await supabaseAdmin
      .from('attendance_events')
      .insert([{
        session_id: sessionId,
        employee_id: session.id,
        event_type: 'HEARTBEAT_RECEIVED',
        sequence_number: nextSequence,
        idempotency_key: `dismiss-${sessionId}-${nextSequence}`,
        client_ip: '0.0.0.0',
        gps_lat: lat ? Number(lat) : null,
        gps_lng: lng ? Number(lng) : null,
        gps_accuracy: 10,
        payload: { audit_event: 'GPS_WARNING_DISMISSED', timestamp: new Date().toISOString() }
      }]);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to log event' };
  }
}

export async function submitDispute(attendanceId: string, category: string, reason: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    if (!reason || reason.trim() === '') {
      return { success: false, error: 'Reason is required' };
    }

    // Verify attendance record ownership to prevent BOLA
    const { data: attendanceRecord, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('employee_id')
      .eq('id', attendanceId)
      .single();

    if (fetchError || !attendanceRecord) {
      return { success: false, error: 'Attendance record not found' };
    }

    if (attendanceRecord.employee_id !== session.id) {
      return { success: false, error: 'Unauthorized: Attendance record does not belong to the current user' };
    }

    // Insert into disputes table
    const { data, error } = await supabaseAdmin
      .from('disputes')
      .insert([{
        employee_id: session.id,
        attendance_id: attendanceId,
        category,
        reason,
        status: 'PENDING',
        evidence_snapshot: {}
      }])
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error inserting dispute:', error);
      return { success: false, error: 'Failed to submit dispute.' };
    }

    // Fetch employee name for the notification
    let employeeName = 'An employee';
    try {
      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('id', session.id)
        .single();
      if (emp?.name) employeeName = emp.name;
    } catch (err) {
      console.warn('Failed to fetch employee name for dispute push:', err);
    }

    // Web Push notification to admins
    try {
      const { data: admins } = await supabaseAdmin.from('admin_users').select('id');
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await dispatchNotification({
            title: `New Dispute Submitted`,
            message: `${employeeName} submitted a dispute for ${category.replace(/_/g, ' ')}. Reason: "${reason}".`,
            type: 'leave_approval_required',
            adminId: admin.id,
            clickActionUrl: '/admin/approvals'
          });
        }
      }
    } catch (pushErr: any) {
      console.warn(`[Push Delivery Failed] action: submitDispute, error: ${pushErr.message}`);
    }

    return { success: true, dispute: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to submit dispute' };
  }
}

export async function getEmployeeDisputes() {
  try {
    const session = await getSession();
    if (!session || !session.id) return [];

    const { data, error } = await supabaseAdmin
      .from('disputes')
      .select('*')
      .eq('employee_id', session.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching employee disputes:', err);
    return [];
  }
}

export async function getAttendanceForMonth(year: number, month: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const { data: records, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', session.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;

    const empRecords = (records || []).map(r => {
      const checkIn = r.check_in ? new Date(r.check_in) : null;
      const checkOut = r.check_out ? new Date(r.check_out) : null;
      let durationHours = 0;
      
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

    return { success: true, records: empRecords };
  } catch (err) {
    console.error('Error fetching attendance for month:', err);
    return { success: false, error: 'Failed to fetch records' };
  }
}

export async function submitOfflineRecoveryRequest(
  action: string,
  timestamp: string,
  lat: number,
  lng: number,
  deviceFingerprint?: string,
  errorMessage?: string
) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveSession(session.id);

    const { error } = await supabaseAdmin
      .from('attendance_recovery_queue')
      .insert([{
        employee_id: session.id,
        action,
        original_timestamp: timestamp,
        gps_lat: Number(lat),
        gps_lng: Number(lng),
        device_fingerprint: deviceFingerprint || null,
        error_message: errorMessage || null,
        status: 'PENDING'
      }]);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/admin/attendance');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to submit recovery request';
    return { success: false, error: errorMsg };
  }
}


export async function updatePortalHolidays(holidaysJson: string) {
  'use server';
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    // Allow admins and hr to manage portal holidays
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized: Admins only' };
    }

    const { error } = await supabaseAdmin
      .from('portal_config')
      .upsert({
        config_key: 'holidays_list',
        config_value: holidaysJson,
        description: 'Office holidays list calendar'
      }, { onConflict: 'config_key' });

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update holidays';
    return { success: false, error: errorMsg };
  }
}
