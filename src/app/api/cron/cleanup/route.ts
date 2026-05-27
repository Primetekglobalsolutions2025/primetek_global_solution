import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
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

    // Call cleanup stored procedures
    const { data: sessionsDeleted, error: err1 } = await supabaseAdmin.rpc('cleanup_expired_sessions');
    if (err1) throw err1;

    const { data: riskDeleted, error: err2 } = await supabaseAdmin.rpc('cleanup_old_risk_events');
    if (err2) throw err2;

    return NextResponse.json({
      success: true,
      message: `Pruned ${sessionsDeleted} expired sessions and ${riskDeleted} old risk events.`,
    });
  } catch (error: any) {
    console.error('Error in cleanup cron:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
