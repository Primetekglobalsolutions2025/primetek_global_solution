import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[Cron/Cleanup] CRON_SECRET is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Sweep stale active sessions (event-sourced FORCE_LOGOUT)
    let sweepResult = null;
    let telemetryResult = null;
    try {
      const { data: teleData, error: teleErr } = await supabaseAdmin.rpc('sweep_active_sessions_telemetry');
      if (teleErr) {
        console.error('[Cron/Cleanup] Telemetry Sweep RPC error:', teleErr.message);
      } else {
        telemetryResult = teleData;
      }

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

    try {
      await supabaseAdmin.rpc('cleanup_stale_presence');
    } catch (presenceErr) {
      console.error('[Cron/Cleanup] Failed to cleanup stale presence:', presenceErr);
    }

    // 3. Purge exported Excel spreadsheets older than 1 hour from exports storage bucket
    let exportsDeletedCount = 0;
    try {
      const { data: files, error: listErr } = await supabaseAdmin
        .storage
        .from('exports')
        .list();

      if (listErr) {
        console.error('[Cron/Cleanup] Failed to list exports bucket:', listErr.message);
      } else if (files && files.length > 0) {
        const now = Date.now();
        const filesToDelete = files
          .filter(file => {
            if (file.name === '.emptyFolderPlaceholder') return false;
            if (!file.created_at) return false;
            const created = new Date(file.created_at).getTime();
            return now - created > 60 * 60 * 1000; // older than 1 hour
          })
          .map(file => file.name);

        if (filesToDelete.length > 0) {
          const { error: removeErr } = await supabaseAdmin
            .storage
            .from('exports')
            .remove(filesToDelete);
          
          if (removeErr) {
            console.error('[Cron/Cleanup] Failed to delete expired exports:', removeErr.message);
          } else {
            exportsDeletedCount = filesToDelete.length;
            console.log(`[Cron/Cleanup] Deleted ${exportsDeletedCount} expired exports from storage.`);
          }
        }
      }
    } catch (storageCatchErr) {
      console.error('[Cron/Cleanup] Exports storage cleanup unexpected error:', storageCatchErr);
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration_ms: durationMs,
      sweep: sweepResult,
      message: `Pruned ${sessionsDeleted} expired sessions, ${riskDeleted} old risk events, and deleted ${exportsDeletedCount} expired exports from storage.`,
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error(`[Cron/Cleanup] Error after ${durationMs}ms:`, errorMessage);
    return NextResponse.json({ error: errorMessage, duration_ms: durationMs }, { status: 500 });
  }
}
