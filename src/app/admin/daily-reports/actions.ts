'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import ExcelJS from 'exceljs';

export async function getAllDailyReports(date: string, employeeId?: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  let query = supabaseAdmin
    .from('profile_daily_metrics')
    .select(`
      id,
      employee_id,
      profile_id,
      report_date,
      applications_count,
      interviews_count,
      assessments,
      technical_rounds,
      non_technical,
      self_submissions,
      support_submissions,
      created_at,
      employee:employees(id, name),
      profile:application_profiles(id, client_name, created_at)
    `)
    .eq('report_date', date);

  if (employeeId && employeeId !== 'all') {
    query = query.eq('employee_id', employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Fetch Daily Reports Error:', error);
    throw error;
  }

  return data || [];
}

export async function getActiveEmployees() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name')
    .eq('status', 'Active')
    .eq('role', 'employee')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getSubmissionStatus(date: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // Fetch all active employees
  const { data: employees, error: empError } = await supabaseAdmin
    .from('employees')
    .select('id, name, department, designation')
    .eq('status', 'Active')
    .eq('role', 'employee')
    .order('name');

  if (empError) throw empError;

  // Fetch employee IDs who submitted reports for the date
  const { data: submissions, error: subError } = await supabaseAdmin
    .from('profile_daily_metrics')
    .select('employee_id')
    .eq('report_date', date);

  if (subError) throw subError;

  const submittedIds = new Set((submissions || []).map(s => s.employee_id));

  return (employees || []).map(emp => ({
    id: emp.id,
    name: emp.name,
    department: emp.department,
    designation: emp.designation,
    submitted: submittedIds.has(emp.id)
  }));
}

export async function exportDailyReportsExcel(date: string, employeeId?: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const reports = await getAllDailyReports(date, employeeId);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Daily Reports');

  // Colors matching PrimeTek Admin aesthetics
  const NAVY = 'FF0F172A';
  const GOLD = 'FFFBBF24'; // Yellow-accent
  const WHITE = 'FFFFFFFF';
  const LIGHT_GRAY = 'FFF8FAFC';
  
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // Header Title
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `Daily Recruitment Reports - ${date}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 40;

  // Columns definition
  const headers = [
    'Assign Date', 'Consultant Name', 'Applications Count', 'Interviews Count',
    'Assessments', 'Technical Rounds', 'Non Technical', 'Self Submissions', 'Support Submissions'
  ];

  ws.getRow(3).values = headers;
  ws.getRow(3).height = 25;
  headers.forEach((_, colIndex) => {
    const cell = ws.getCell(3, colIndex + 1);
    cell.font = { bold: true, color: { argb: NAVY } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  // Group reports by employee
  const grouped: Record<string, typeof reports> = {};
  reports.forEach(r => {
    const empData = r.employee as any;
    const empName = (Array.isArray(empData) ? empData[0]?.name : empData?.name) || 'Unknown Employee';
    if (!grouped[empName]) grouped[empName] = [];
    grouped[empName].push(r);
  });

  let currentRow = 4;

  Object.entries(grouped).forEach(([empName, items]) => {
    // Add Employee Group Header Row
    ws.mergeCells(currentRow, 1, currentRow, 9);
    const empHeader = ws.getCell(currentRow, 1);
    empHeader.value = empName.toUpperCase();
    empHeader.font = { bold: true, color: { argb: WHITE }, size: 11 };
    empHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    empHeader.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(currentRow).height = 22;
    currentRow++;

    let empApps = 0;
    let empInts = 0;
    let empAssess = 0;
    let empTech = 0;
    let empNonTech = 0;
    let empSelf = 0;
    let empSupp = 0;

    items.forEach(item => {
      const profData = item.profile as any;
      const profileObj = Array.isArray(profData) ? profData[0] : profData;
      const pDate = profileObj?.created_at 
        ? new Date(profileObj.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) 
        : '—';
      const cName = profileObj?.client_name || 'N/A';

      ws.getRow(currentRow).values = [
        pDate,
        cName,
        item.applications_count,
        item.interviews_count,
        item.assessments,
        item.technical_rounds,
        item.non_technical,
        item.self_submissions,
        item.support_submissions
      ];
      ws.getRow(currentRow).height = 20;

      // Formatting
      for (let c = 1; c <= 9; c++) {
        const cell = ws.getCell(currentRow, c);
        cell.alignment = c > 2 ? { horizontal: 'center' } : { horizontal: 'left' };
        cell.border = thinBorder;
      }

      empApps += item.applications_count;
      empInts += item.interviews_count;
      empAssess += item.assessments;
      empTech += item.technical_rounds;
      empNonTech += item.non_technical;
      empSelf += item.self_submissions;
      empSupp += item.support_submissions;

      currentRow++;
    });

    // Add Employee Total Row
    ws.getRow(currentRow).values = [
      '',
      'Total for ' + empName,
      empApps,
      empInts,
      empAssess,
      empTech,
      empNonTech,
      empSelf,
      empSupp
    ];
    ws.getRow(currentRow).height = 22;
    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(currentRow, c);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
      cell.border = thinBorder;
      if (c > 2) cell.alignment = { horizontal: 'center' };
    }
    currentRow++;
  });

  // Set widths
  ws.getColumn(1).width = 15;
  ws.getColumn(2).width = 25;
  for (let c = 3; c <= 9; c++) {
    ws.getColumn(c).width = 16;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}
