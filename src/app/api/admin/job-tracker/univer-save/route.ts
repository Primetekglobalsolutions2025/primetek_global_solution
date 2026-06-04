import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.content) {
      return NextResponse.json({ error: 'Missing content payload' }, { status: 400 });
    }

    const { content } = body;

    const { error } = await supabaseAdmin
      .from('job_tracker_sheets')
      .upsert({
        sheet_name: 'Master_Job_Tracker',
        content: content,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'sheet_name'
      });

    if (error) {
      console.error('[Univer Save API] Supabase error:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Univer Save API] Error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
