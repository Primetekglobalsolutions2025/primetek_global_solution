import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_SHEET_DATA = {
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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: record, error } = await supabaseAdmin
      .from('job_tracker_sheets')
      .select('content')
      .eq('sheet_name', 'Master_Job_Tracker')
      .maybeSingle();

    if (error) {
      console.error('[Univer Load API] Supabase error:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const content = record?.content || DEFAULT_SHEET_DATA;

    return NextResponse.json({
      success: true,
      data: content
    });
  } catch (err) {
    console.error('[Univer Load API] Error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
