'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { logAuditAction } from '@/lib/audit';

declare module 'exceljs' {
  interface Worksheet {
    dataValidations: {
      add(address: string, validation: ExcelJS.DataValidation): void;
    };
  }
}

/**
 * Proactively sweep and close all stale active sessions across the entire
 * workforce. Invokes the database-level sweeper which appends FORCE_LOGOUT
 * events and rebuilds projections — fully event-sourced.
 * 
 * This is fire-and-forget: errors are logged but never block callers.
 */
async function sweepGlobalStaleSessions(): Promise<{ closed: number; errors: number } | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('sweep_and_close_stale_sessions');
    if (error) {
      console.error('[StaleSweeper] RPC error:', error.message);
      return null;
    }
    if (data && (data as any).closed > 0) {
      console.log(`[StaleSweeper] Closed ${(data as any).closed} stale sessions, ${(data as any).errors} errors`);
    }
    return data as { closed: number; errors: number } | null;
  } catch (err) {
    console.error('[StaleSweeper] Unexpected error:', err);
    return null;
  }
}

export async function getAdminAttendance(startDate?: string, endDate?: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // Proactively sweep stale sessions before fetching — guarantees live monitor accuracy
  await sweepGlobalStaleSessions();

  let query = supabaseAdmin
    .from('attendance')
    .select(`
      *,
      employees (
        name
      )
    `);

  if (startDate) {
    query = query.gte('date', startDate);
  } else {
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
  }

  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query
    .order('check_in', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching admin attendance:', error);
    return [];
  }

  const recordIds = (data || []).map(record => record.id);
  let riskEvents: any[] = [];
  if (recordIds.length > 0) {
    const { data: fetchedEvents } = await supabaseAdmin
      .from('attendance_risk_events')
      .select('*')
      .in('attendance_id', recordIds)
      .order('created_at', { ascending: false });
    if (fetchedEvents) {
      riskEvents = fetchedEvents;
    }
  }

  const riskMap: Record<string, any[]> = {};
  if (riskEvents) {
    riskEvents.forEach((evt) => {
      if (evt.attendance_id) {
        if (!riskMap[evt.attendance_id]) {
          riskMap[evt.attendance_id] = [];
        }
        riskMap[evt.attendance_id].push(evt);
      }
    });
  }
  if (!data) return [];

  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((record: Record<string, any>) => {
    const checkIn = record.check_in ? new Date(record.check_in) : null;
    const checkOut = record.check_out ? new Date(record.check_out) : null;
    let durationHours = 0;
    
    if (checkIn && checkOut) {
      durationHours = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 10) / 10;
    }

    const recordRisks = riskMap[record.id] || [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let riskScore = 0;
    let riskReasons: any[] = [];
    
    recordRisks.forEach((r) => {
      if (r.risk_score > riskScore) {
        riskScore = r.risk_score;
        riskLevel = r.risk_level as 'low' | 'medium' | 'high';
      }
      if (r.risk_reasons) {
        riskReasons = [...riskReasons, ...(Array.isArray(r.risk_reasons) ? r.risk_reasons : [])];
      }
    });

    return {
      id: record.id,
      employee_id: record.employee_id,
      employee_name: record.employees?.name || 'Unknown',
      date: record.date || (record.check_in ? record.check_in.split('T')[0] : ''),
      check_in: checkIn && !isNaN(checkIn.getTime()) ? checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—',
      check_out: checkOut && !isNaN(checkOut.getTime()) ? checkOut.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null,
      check_in_raw: record.check_in,
      check_out_raw: record.check_out,
      duration_hours: durationHours,
      status: record.status,
      lat: record.lat || 0,
      lng: record.lng || 0,
      risk_level: riskLevel,
      risk_score: riskScore,
      risk_reasons: riskReasons,
      risk_events: recordRisks,
      // Break monitoring
      current_break_start: record.current_break_start,
      total_break_seconds: record.total_break_seconds || 0,
      productive_hours: record.productive_hours || 0.0,
      // Late login penalty
      is_late: record.is_late || false,
      late_minutes: record.late_minutes || 0,
      deduction_applied: record.deduction_applied || 0.0,
      // Exemptions
      late_approved: record.late_approved || false,
      permission_approved: record.permission_approved || false,
      shift_override: record.shift_override || false,
      manager_exemption: record.manager_exemption || false,
      // Device and validation info
      device_type: record.device_type || 'desktop',
      device_label: record.device_label || 'Desktop',
      awaiting_desktop_deadline: record.awaiting_desktop_deadline || null,
    };
  });
}

export async function getEmployeesList() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name')
    .order('name', { ascending: true });
    
  if (error) return [];
  return data;
}

export async function exportAttendanceExcel(year: number) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  await logAuditAction(
    'EXPORT_ATTENDANCE_EXCEL',
    'attendance',
    undefined,
    null,
    { year }
  );

  const { data: employees, error: empError } = await supabaseAdmin
    .from('employees')
    .select('id, name')
    .order('name', { ascending: true });

  if (empError) throw new Error('Failed to fetch employees');

  const getColLetter = (colIdx: number) => {
    let temp, letter = '';
    while (colIdx > 0) {
      temp = (colIdx - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      colIdx = (colIdx - temp - 1) / 26;
    }
    return letter;
  };

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const { data: attendanceData, error: attError } = await supabaseAdmin
    .from('attendance')
    .select('employee_id, date, status')
    .gte('date', startDate)
    .lte('date', endDate);

  if (attError) throw new Error('Failed to fetch attendance');

  const attendanceMap: Record<string, Record<string, string>> = {};
  attendanceData.forEach((rec) => {
    if (!attendanceMap[rec.employee_id]) attendanceMap[rec.employee_id] = {};
    attendanceMap[rec.employee_id][rec.date] = rec.status;
  });

  const wb = new ExcelJS.Workbook();
  const DARK_TEAL = 'FF1B4D4F';
  const MID_TEAL = 'FF2A7C7F';
  const WHITE = 'FFFFFFFF';
  const WO_BG = 'FFFFEBEE';
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFBDBDBD' } },
    left: { style: 'thin', color: { argb: 'FFBDBDBD' } },
    bottom: { style: 'thin', color: { argb: 'FFBDBDBD' } },
    right: { style: 'thin', color: { argb: 'FFBDBDBD' } }
  };

  const guideSheet = wb.addWorksheet('Guide');
  guideSheet.getColumn(1).width = 3;
  guideSheet.getColumn(2).width = 30;
  guideSheet.getColumn(3).width = 60;

  guideSheet.mergeCells('B2:C2');
  const b2 = guideSheet.getCell('B2');
  b2.value = 'Attendance System User Guide';
  b2.font = { name: 'Calibri', size: 18, bold: true, color: { argb: DARK_TEAL } };

  const b4 = guideSheet.getCell('B4');
  b4.value = 'How to add new employees:';
  b4.font = { bold: true, size: 12 };
  guideSheet.getCell('B5').value = "Simply type the new employee's name in the next empty row under the 'Employee Name' column.";
  guideSheet.getCell('B6').value = "The S.No and all calculation formulas are already pre-filled for all employees.";

  const guideHeaders = ["Code", "Description", "Calculation Rule"];
  guideHeaders.forEach((h, i) => {
    const cell = guideSheet.getCell(8, i + 2);
    cell.value = h;
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MID_TEAL } };
    cell.alignment = { horizontal: 'center' };
    cell.border = thinBorder;
  });

  const codes = [
    { code: "P", desc: "Present", rule: "1.0 day" },
    { code: "A", desc: "Absent", rule: "1.0 day" },
    { code: "L", desc: "Leave", rule: "1.0 day" },
    { code: "HD", desc: "Half Day", rule: "0.5 days" },
    { code: "WO", desc: "Weekly Off", rule: "Sat/Sun" }
  ];
  
  codes.forEach((c, i) => {
    const row = 9 + i;
    const cellB = guideSheet.getCell(row, 2);
    cellB.value = c.code;
    cellB.alignment = { horizontal: 'center' };
    cellB.border = thinBorder;
    
    const cellC = guideSheet.getCell(row, 3);
    cellC.value = `${c.desc}: ${c.rule}`;
    cellC.border = thinBorder;
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const daysInMonth = (month: number, yr: number) => new Date(yr, month, 0).getDate();

  for (let m = 0; m < 12; m++) {
    const monthIndex = m + 1;
    const days = daysInMonth(monthIndex, year);
    const ws = wb.addWorksheet(monthNames[m]);
    
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 25;
    const summaryStartCol = days + 3;

    ws.mergeCells(1, 1, 1, summaryStartCol + 3);
    const a1 = ws.getCell('A1');
    a1.value = "PRIMETEK GLOBAL SOLUTIONS";
    a1.font = { size: 16, bold: true, color: { argb: WHITE } };
    a1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_TEAL } };
    a1.alignment = { horizontal: 'center' };

    ws.mergeCells(2, 1, 2, summaryStartCol + 3);
    const a2 = ws.getCell('A2');
    a2.value = `Attendance Register - ${monthNames[m]} ${year}`;
    a2.font = { size: 12, bold: true, color: { argb: WHITE } };
    a2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MID_TEAL } };
    a2.alignment = { horizontal: 'center' };

    const c31 = ws.getCell(3, 1); c31.value = "S.No"; c31.border = thinBorder;
    const c32 = ws.getCell(3, 2); c32.value = "Employee Name"; c32.border = thinBorder;

    for (let d = 1; d <= days; d++) {
      const c = ws.getCell(3, d + 2);
      c.value = d;
      c.border = thinBorder;
      
      const dt = new Date(year, m, d);
      const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const r4c = ws.getCell(4, d + 2);
      r4c.value = dayName;
      r4c.border = thinBorder;
    }

    const summaryLabels = ["Present", "Absent", "Leave", "Working Days"];
    summaryLabels.forEach((label, i) => {
      const col = summaryStartCol + i;
      const cell = ws.getCell(3, col);
      cell.value = label;
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MID_TEAL } };
      cell.border = thinBorder;
      ws.mergeCells(3, col, 4, col);
    });

    const employeeCount = employees.length;
    for (let idx = 0; idx < employeeCount; idx++) {
      const r = 5 + idx;
      const emp = employees[idx] || null;
      
      const c1 = ws.getCell(r, 1);
      c1.value = { formula: `IF(B${r}<>"", ${idx+1}, "")`, result: emp ? idx + 1 : '' };
      c1.border = thinBorder;
      
      const c2 = ws.getCell(r, 2);
      if (emp) c2.value = emp.name;
      c2.border = thinBorder;

      let empAtt: Record<string, string> | null = null;
      if (emp && attendanceMap[emp.id]) {
        empAtt = attendanceMap[emp.id];
      }

      for (let d = 1; d <= days; d++) {
        const col = d + 2;
        const cell = ws.getCell(r, col);
        cell.border = thinBorder;
        const dt = new Date(year, m, d);
        const dayOfWeek = dt.getDay();
        
        let statusCode = "";
        if (empAtt) {
          const dateStr = `${year}-${String(monthIndex).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const status = empAtt[dateStr];
          if (status === 'Present') statusCode = 'P';
          else if (status === 'Late') statusCode = 'P';
          else if (status === 'Absent') statusCode = 'A';
          else if (status === 'Half-day') statusCode = 'HD';
        }

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          cell.value = "WO";
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WO_BG } };
        } else {
          if (statusCode) cell.value = statusCode;
        }
      }

      const rng = `${getColLetter(3)}${r}:${getColLetter(days + 2)}${r}`;
      
      ws.getCell(r, summaryStartCol).value = { formula: `IF(B${r}="","", COUNTIF(${rng},"P")+COUNTIF(${rng},"HD")*0.5)` };
      ws.getCell(r, summaryStartCol + 1).value = { formula: `IF(B${r}="","", COUNTIF(${rng},"A"))` };
      ws.getCell(r, summaryStartCol + 2).value = { formula: `IF(B${r}="","", COUNTIF(${rng},"L"))` };
      
      const pRef = `${getColLetter(summaryStartCol)}${r}`;
      const aRef = `${getColLetter(summaryStartCol + 1)}${r}`;
      const lRef = `${getColLetter(summaryStartCol + 2)}${r}`;
      ws.getCell(r, summaryStartCol + 3).value = { formula: `IF(B${r}="","", ${pRef}+${aRef}+${lRef})` };
    }

    if (employeeCount > 0) {
      ws.dataValidations.add(`C5:${getColLetter(days + 2)}${4 + employeeCount}`, {
        type: 'list',
        allowBlank: true,
        formulae: ['"P,A,L,HD,WO"']
      });
    }

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `attendance-${year}-${Date.now()}.xlsx`;

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from('exports')
    .upload(fileName, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true
    });

  if (uploadError) {
    console.error('[exportAttendanceExcel] Upload error:', uploadError);
    throw new Error('Failed to upload Excel export to storage');
  }

  const { data: signedData, error: signedError } = await supabaseAdmin
    .storage
    .from('exports')
    .createSignedUrl(fileName, 300); // 5 minutes expiration

  if (signedError || !signedData?.signedUrl) {
    console.error('[exportAttendanceExcel] Signed URL generation error:', signedError);
    throw new Error('Failed to generate download URL');
  }

  return { url: signedData.signedUrl };
}

export async function toggleExemption(recordId: string, fieldName: string, value: boolean) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const allowedFields = ['late_approved', 'permission_approved', 'shift_override', 'manager_exemption'];
  if (!allowedFields.includes(fieldName)) {
    throw new Error('Invalid exemption field');
  }

  if (typeof value !== 'boolean') {
    throw new Error('Value must be a boolean');
  }

  const { data: oldRecord, error: fetchError } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', recordId)
    .single();

  if (fetchError || !oldRecord) throw new Error('Record not found');

  // Fetch the last sequence number for the session's event stream
  const { data: lastEvent } = await supabaseAdmin
    .from('attendance_events')
    .select('sequence_number')
    .eq('session_id', recordId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastEvent?.sequence_number || 1) + 1;

  // Insert ADMIN_OVERRIDE event instead of direct mutation
  const { error: insertError } = await supabaseAdmin
    .from('attendance_events')
    .insert([{
      session_id: recordId,
      employee_id: oldRecord.employee_id,
      event_type: 'ADMIN_OVERRIDE',
      sequence_number: nextSequence,
      idempotency_key: `override-${recordId}-${fieldName}-${value}-${nextSequence}`,
      client_ip: '0.0.0.0', // Admin action
      payload: {
        override_field: fieldName,
        old_value: oldRecord[fieldName],
        new_value: value,
        reason: 'Administrative exemption override',
        admin_id: session.id
      }
    }]);

  if (insertError) {
    console.error('Error logging ADMIN_OVERRIDE event:', insertError);
    throw new Error('Database transaction failed to append override');
  }

  await logAuditAction(
    'TOGGLE_ATTENDANCE_EXEMPTION',
    'attendance',
    recordId,
    { [fieldName]: oldRecord[fieldName] },
    { [fieldName]: value }
  );

  const recordDate = new Date(oldRecord.date);
  const year = recordDate.getFullYear();
  const month = recordDate.getMonth() + 1;

  // Trigger projection rebuild to apply the override event
  const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
    p_session_id: recordId
  });

  if (rebuildError) {
    console.error('Error rebuilding projection in toggleExemption:', rebuildError);
    throw new Error('Database projection rebuild failed');
  }
  
  await recalculateEmployeeLates(oldRecord.employee_id, year, month);

  const { revalidatePath: nextRevalidatePath } = await import('next/cache');
  nextRevalidatePath('/admin/attendance');
  nextRevalidatePath('/employee/attendance');

  return { success: true };
}

export async function recalculateEmployeeLates(employeeId: string, year: number, month: number) {
  // Execute transaction-locked PL/pgSQL function to prevent race conditions
  const { error } = await supabaseAdmin.rpc('recalculate_employee_lates_safe', {
    p_employee_id: employeeId,
    p_year: year,
    p_month: month
  });

  if (error) {
    console.error('Error running recalculate_employee_lates_safe:', error);
    throw new Error('Lates recalculation failed');
  }
}

export async function getSessionEvents(sessionId: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('attendance_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });

  if (error) {
    console.error('Error fetching session events:', error);
    throw new Error('Failed to fetch session events');
  }

  return data || [];
}

export async function reverseAutoBreak(sessionId: string, reason: string) {
  if (!reason || reason.trim() === '') throw new Error('Justification reason is required');
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data: oldRecord } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!oldRecord) throw new Error('Session not found');

  const { data: lastEvent } = await supabaseAdmin
    .from('attendance_events')
    .select('sequence_number')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastEvent?.sequence_number || 1) + 1;

  const { error: insertError } = await supabaseAdmin
    .from('attendance_events')
    .insert([{
      session_id: sessionId,
      employee_id: oldRecord.employee_id,
      event_type: 'BREAK_ENDED',
      sequence_number: nextSequence,
      idempotency_key: `reverse-autobreak-${sessionId}-${nextSequence}`,
      client_ip: '0.0.0.0',
      payload: {
        reason,
        admin_id: session.id,
        reversal_of: 'AUTO_BREAK'
      }
    }]);

  if (insertError) {
    console.error('Error logging BREAK_ENDED event:', insertError);
    throw new Error('Database transaction failed to append break end event');
  }

  const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
    p_session_id: sessionId
  });
  if (rebuildError) {
    console.error('Error rebuilding projection after reverseAutoBreak:', rebuildError);
    throw new Error('Failed to rebuild projection');
  }

  await logAuditAction(
    'REVERSE_AUTO_BREAK',
    'attendance',
    sessionId,
    { reason },
    { status: 'ACTIVE' }
  );

  const { revalidatePath: nextRevalidatePath } = await import('next/cache');
  nextRevalidatePath('/admin/attendance');
  nextRevalidatePath('/employee/attendance');

  return { success: true };
}

export async function correctClockOutTime(sessionId: string, clockOutTime: string, reason: string) {
  if (!reason || reason.trim() === '') throw new Error('Justification reason is required');
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data: oldRecord } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!oldRecord) throw new Error('Session not found');

  const { data: lastEvent } = await supabaseAdmin
    .from('attendance_events')
    .select('sequence_number')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastEvent?.sequence_number || 1) + 1;

  const { error: insertError } = await supabaseAdmin
    .from('attendance_events')
    .insert([{
      session_id: sessionId,
      employee_id: oldRecord.employee_id,
      event_type: 'CLOCK_OUT',
      sequence_number: nextSequence,
      idempotency_key: `correct-clockout-${sessionId}-${nextSequence}`,
      client_ip: '0.0.0.0',
      event_timestamp: clockOutTime,
      payload: {
        reason,
        admin_id: session.id,
        is_override: true
      }
    }]);

  if (insertError) {
    console.error('Error logging adjusted CLOCK_OUT event:', insertError);
    throw new Error('Database transaction failed to append adjusted clock out');
  }

  const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
    p_session_id: sessionId
  });
  if (rebuildError) {
    console.error('Error rebuilding projection after correctClockOutTime:', rebuildError);
    throw new Error('Failed to rebuild projection');
  }

  await logAuditAction(
    'CORRECT_CLOCK_OUT_TIME',
    'attendance',
    sessionId,
    { reason, old_clock_out: oldRecord.check_out },
    { check_out: clockOutTime }
  );

  const { revalidatePath: nextRevalidatePath } = await import('next/cache');
  nextRevalidatePath('/admin/attendance');
  nextRevalidatePath('/employee/attendance');

  return { success: true };
}

export async function rebuildSessionProjection(sessionId: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data: record } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!record) throw new Error('Session not found');

  const { error } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
    p_session_id: sessionId
  });

  if (error) {
    console.error('Error rebuilding session projection:', error);
    throw new Error('Rebuild projection failed');
  }

  const recordDate = new Date(record.date);
  const year = recordDate.getFullYear();
  const month = recordDate.getMonth() + 1;
  await recalculateEmployeeLates(record.employee_id, year, month);

  const { revalidatePath: nextRevalidatePath } = await import('next/cache');
  nextRevalidatePath('/admin/attendance');
  nextRevalidatePath('/employee/attendance');

  return { success: true };
}

export async function overrideDeviceValidation(
  recordId: string,
  actionType: 'approve_mobile' | 'resume_timer' | 'field_work',
  justification: string
) {
  if (!justification || justification.trim() === '') {
    throw new Error('Justification reason is required');
  }
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data: oldRecord } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', recordId)
    .single();
  if (!oldRecord) throw new Error('Session not found');

  const { data: lastEvent } = await supabaseAdmin
    .from('attendance_events')
    .select('sequence_number')
    .eq('session_id', recordId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastEvent?.sequence_number || 1) + 1;

  let targetStatus = 'DESKTOP_ACTIVE';
  if (actionType === 'approve_mobile') {
    targetStatus = 'MOBILE_CLOCKED_IN';
  }

  // Insert ADMIN_OVERRIDE event to change status
  const { error: insertError } = await supabaseAdmin
    .from('attendance_events')
    .insert([{
      session_id: recordId,
      employee_id: oldRecord.employee_id,
      event_type: 'ADMIN_OVERRIDE',
      sequence_number: nextSequence,
      idempotency_key: `override-validation-${recordId}-${actionType}-${nextSequence}`,
      client_ip: '0.0.0.0',
      payload: {
        override_field: 'status',
        old_value: oldRecord.status,
        new_value: targetStatus,
        reason: justification,
        action_type: actionType,
        admin_id: session.id
      }
    }]);

  if (insertError) {
    console.error('Error logging ADMIN_OVERRIDE event for device validation:', insertError);
    throw new Error('Database transaction failed to append override');
  }

  await logAuditAction(
    'OVERRIDE_DEVICE_VALIDATION',
    'attendance',
    recordId,
    { status: oldRecord.status },
    { status: targetStatus, justification, actionType }
  );

  // Trigger projection rebuild to apply the override event
  const { error: rebuildError } = await supabaseAdmin.rpc('rebuild_attendance_projection', {
    p_session_id: recordId
  });

  if (rebuildError) {
    console.error('Error rebuilding projection in overrideDeviceValidation:', rebuildError);
    throw new Error('Database projection rebuild failed');
  }

  const recordDate = new Date(oldRecord.date);
  const year = recordDate.getFullYear();
  const month = recordDate.getMonth() + 1;
  await recalculateEmployeeLates(oldRecord.employee_id, year, month);

  const { revalidatePath: nextRevalidatePath } = await import('next/cache');
  nextRevalidatePath('/admin/attendance');
  nextRevalidatePath('/employee/attendance');

  return { success: true };
}

