import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch sheet data from Supabase
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from('job_tracker_sheets')
      .select('content')
      .eq('sheet_name', 'Master_Job_Tracker')
      .maybeSingle();

    if (fetchErr) {
      console.error('[Job Tracker API] Supabase fetch error:', fetchErr.message);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    if (!record || !record.content || !record.content.sheets) {
      // No sheet data yet, return empty list
      return NextResponse.json({ success: true, data: [] });
    }

    const content = record.content;
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

    // Deduplicate applications by URL and map claimedBy list
    const uniqueApplications: any[] = [];
    const seenUrls: Record<string, boolean> = {};
    allApplications.forEach(app => {
      const urlKey = app.url.toString().trim().toLowerCase();
      if (!urlKey) {
        uniqueApplications.push({
          ...app,
          claimedBy: app.employeeName
        });
        return;
      }
      if (!seenUrls[urlKey]) {
        seenUrls[urlKey] = true;
        const claimers = urlClaims[urlKey] ? urlClaims[urlKey].join(', ') : app.employeeName;
        uniqueApplications.push({
          ...app,
          claimedBy: claimers
        });
      }
    });

    return NextResponse.json({ success: true, data: uniqueApplications });
  } catch (error: any) {
    console.error('[Job Tracker API] Error fetching job applications:', error);
    return NextResponse.json(
      { error: error?.message || 'An internal error occurred while fetching job applications.' },
      { status: 500 }
    );
  }
}
