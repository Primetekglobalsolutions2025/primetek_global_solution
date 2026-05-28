import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getISTShiftDate } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    // Mandatory CRON_SECRET authorization check in all environments
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[Cron/LatePenalty] CRON_SECRET is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current year and month in IST
    const todayIST = getISTShiftDate(new Date());
    const [year, month] = todayIST.split('-').map(Number);

    // Call the PostgreSQL stored procedure via RPC to do batch calculations in a single transaction
    const { error: rpcError } = await supabaseAdmin.rpc('recalculate_all_employee_lates', {
      p_year: year,
      p_month: month
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({
      success: true,
      message: `Recalculated lates and applied penalties via RPC for all active employees for ${month}/${year}.`,
    });
  } catch (error: any) {
    console.error('Error in late penalty cron:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

