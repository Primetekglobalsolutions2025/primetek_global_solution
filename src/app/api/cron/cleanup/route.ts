import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 1. Sweep stale active sessions (event-sourced FORCE_LOGOUT)
    let sweepResult = null;
    try {
      const { data, error: sweepErr } = await supabaseAdmin.rpc('sweep_and_close_stale_sessions');
      if (sweepErr) {
        console.error('[Cron/Cleanup] Sweep RPC error:', sweepErr.message);
      } else {
        sweepResult = data;
      }
    } catch (sweepCatchErr) {
      console.error('[Cron/Cleanup] Sweep unexpected error:', sweepCatchErr);
    }

    // 2. Call existing cleanup stored procedures
    const { data: sessionsDeleted, error: err1 } = await supabaseAdmin.rpc('cleanup_expired_sessions');
    if (err1) throw err1;

    const { data: riskDeleted, error: err2 } = await supabaseAdmin.rpc('cleanup_old_risk_events');
    if (err2) throw err2;

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration_ms: durationMs,
      sweep: sweepResult,
      message: `Pruned ${sessionsDeleted} expired sessions and ${riskDeleted} old risk events.`,
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error(`[Cron/Cleanup] Error after ${durationMs}ms:`, errorMessage);
    return NextResponse.json({ error: errorMessage, duration_ms: durationMs }, { status: 500 });
  }
}
