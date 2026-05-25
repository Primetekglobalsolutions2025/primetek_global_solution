import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { recalculateEmployeeLates } from '@/app/admin/attendance/actions';

export async function GET(req: Request) {
  try {
    // Standard Vercel Cron authorization check
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active employees
    const { data: employees, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('status', 'Active');

    if (empError) throw empError;

    // Get current year and month in IST
    const offset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + offset);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth() + 1; // 1-12

    const processed = [];
    for (const emp of employees) {
      await recalculateEmployeeLates(emp.id, year, month);
      processed.push(emp.id);
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated lates and applied penalties for ${processed.length} active employees for ${month}/${year}.`,
      processed_count: processed.length,
    });
  } catch (error: any) {
    console.error('Error in late penalty cron:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
