import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const { data: presence, error } = await supabaseAdmin
      .from('employee_presence')
      .select('employee_id, status, last_activity, last_heartbeat, break_started_at, updated_at')
      .eq('employee_id', payload.id)
      .maybeSingle();

    if (error) {
      console.error('[Presence/Status] Fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    if (!presence) {
      return NextResponse.json({ status: 'offline', last_activity: null, last_heartbeat: null });
    }

    return new Response(JSON.stringify(presence), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    console.error('[Presence/Status] Server error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
