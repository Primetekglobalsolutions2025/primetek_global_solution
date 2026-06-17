import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.jobRole || !body.clientName || !body.applicationUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { jobRole, clientName, applicationUrl } = body;
    const employeeName = payload.name || 'Unknown Employee';

    // 1. Fetch current sheet state
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('job_tracker_sheets')
      .select('content')
      .eq('sheet_name', 'Master_Job_Tracker')
      .maybeSingle();

    if (fetchErr) {
      console.error('[save-job API] Supabase fetch error:', fetchErr.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Initialize default structure if empty
    const content = record?.content || {
      id: 'Master_Job_Tracker',
      name: 'Master Job Tracker',
      sheets: {
        'sheet-home': {
          id: 'sheet-home',
          name: 'Home',
          rowCount: 100,
          columnCount: 20,
          cellData: {
            '0': {
              '0': { v: 'S.No', s: { font: { bold: true } } },
              '1': { v: 'Date/Month', s: { font: { bold: true } } },
              '2': { v: 'Job Role', s: { font: { bold: true } } },
              '3': { v: 'Client Name', s: { font: { bold: true } } },
              '4': { v: 'Application URL', s: { font: { bold: true } } },
              '5': { v: 'Action', s: { font: { bold: true } } },
              '6': { v: 'Claimed By', s: { font: { bold: true } } },
              '7': { v: 'Claim Job', s: { font: { bold: true } } }
            }
          }
        }
      }
    };

    // 2. Resolve employee tab in the JSON workbook
    let employeeSheetId = '';
    const sheetsMap = content.sheets;
    Object.keys(sheetsMap).forEach(id => {
      if (sheetsMap[id].name.toLowerCase() === employeeName.toLowerCase()) {
        employeeSheetId = id;
      }
    });

    if (!employeeSheetId) {
      employeeSheetId = `sheet-${Date.now()}`;
      sheetsMap[employeeSheetId] = {
        id: employeeSheetId,
        name: employeeName,
        rowCount: 100,
        columnCount: 10,
        cellData: {
          '0': {
            '0': { v: 'Date/Month', s: { font: { bold: true } } },
            '1': { v: 'Job Role', s: { font: { bold: true } } },
            '2': { v: 'Client Name', s: { font: { bold: true } } },
            '3': { v: 'Application URL', s: { font: { bold: true } } }
          }
        }
      };
    }

    // 3. Append the new row to the employee sheet
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const formattedDate = `${("0" + now.getDate()).slice(-2)}-${months[now.getMonth()]}`;

    appendRowToUniverSheet(sheetsMap[employeeSheetId], [formattedDate, jobRole, clientName, applicationUrl]);

    // 4. Rebuild the Home sheet dynamically
    rebuildHomeSheet(content);

    // 5. Upsert sheet content
    const { error: saveErr } = await supabaseAdmin
      .from('job_tracker_sheets')
      .upsert({
        sheet_name: 'Master_Job_Tracker',
        content: content,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'sheet_name'
      });

    if (saveErr) {
      console.error('[save-job API] Supabase save error:', saveErr.message);
      return NextResponse.json({ error: 'Database save error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[save-job API] Error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function appendRowToUniverSheet(sheet: any, rowValues: string[]) {
  if (!sheet.cellData) {
    sheet.cellData = {};
  }
  let maxRow = -1;
  Object.keys(sheet.cellData).forEach(rowIdx => {
    const r = parseInt(rowIdx, 10);
    if (!isNaN(r) && r > maxRow) {
      maxRow = r;
    }
  });

  const nextRowIdx = (maxRow + 1).toString();
  sheet.cellData[nextRowIdx] = {};
  rowValues.forEach((val, colIdx) => {
    sheet.cellData[nextRowIdx][colIdx.toString()] = { v: val };
  });

  if (parseInt(nextRowIdx, 10) >= (sheet.rowCount || 0)) {
    sheet.rowCount = parseInt(nextRowIdx, 10) + 50;
  }
}

function rebuildHomeSheet(content: any) {
  const urlClaims: Record<string, string[]> = {};
  const allApplications: any[] = [];

  // Scan all employee sheets
  Object.keys(content.sheets).forEach(id => {
    const sheet = content.sheets[id];
    const name = sheet.name;
    if (name === 'Home' || name === 'Dashboard') return;

    const cellData = sheet.cellData || {};
    let maxRow = -1;
    Object.keys(cellData).forEach(rowIdx => {
      const r = parseInt(rowIdx, 10);
      if (!isNaN(r) && r > maxRow) maxRow = r;
    });

    for (let r = 1; r <= maxRow; r++) {
      const row = cellData[r.toString()];
      if (!row) continue;
      
      const jobRole = row['1']?.v || '';
      const clientName = row['2']?.v || '';
      const url = row['3']?.v || '';
      const dateStr = row['0']?.v || '';

      if (!jobRole && !clientName) continue;

      const urlKey = url.toString().trim().toLowerCase();
      if (urlKey) {
        if (!urlClaims[urlKey]) {
          urlClaims[urlKey] = [];
        }
        if (!urlClaims[urlKey].includes(name)) {
          urlClaims[urlKey].push(name);
        }
      }

      allApplications.push({
        employeeName: name,
        timestamp: dateStr,
        jobRole,
        clientName,
        url
      });
    }
  });

  // Deduplicate by URL
  const uniqueApplications: any[] = [];
  const seenUrls: Record<string, any> = {};
  allApplications.forEach(app => {
    const urlKey = app.url.toString().trim().toLowerCase();
    if (!urlKey) {
      uniqueApplications.push(app);
      return;
    }
    if (!seenUrls[urlKey]) {
      seenUrls[urlKey] = app;
      uniqueApplications.push(app);
    }
  });

  // Rebuild sheet-home cellData
  const homeSheet = content.sheets['sheet-home'];
  homeSheet.cellData = {
    '0': {
      '0': { v: 'S.No', s: { font: { bold: true } } },
      '1': { v: 'Date/Month', s: { font: { bold: true } } },
      '2': { v: 'Job Role', s: { font: { bold: true } } },
      '3': { v: 'Client Name', s: { font: { bold: true } } },
      '4': { v: 'Application URL', s: { font: { bold: true } } },
      '5': { v: 'Action', s: { font: { bold: true } } },
      '6': { v: 'Claimed By', s: { font: { bold: true } } },
      '7': { v: 'Claim Job', s: { font: { bold: true } } }
    }
  };

  uniqueApplications.forEach((app, idx) => {
    const rowIdx = (idx + 1).toString();
    const urlKey = app.url.toString().trim().toLowerCase();
    const claimedByList = urlClaims[urlKey] ? urlClaims[urlKey].join(', ') : app.employeeName;
    const formulaText = `=HYPERLINK(E${idx + 2}, "Apply 🔗")`; // Row 0 is header, so row 1 is E2

    homeSheet.cellData[rowIdx] = {
      '0': { v: (idx + 1).toString() },
      '1': { v: app.timestamp },
      '2': { v: app.jobRole },
      '3': { v: app.clientName },
      '4': { v: app.url },
      '5': { v: 'Apply 🔗', f: formulaText },
      '6': { v: claimedByList },
      '7': { v: 'Claim Job ➕' }
    };
  });

  homeSheet.rowCount = Math.max(100, uniqueApplications.length + 50);
}
