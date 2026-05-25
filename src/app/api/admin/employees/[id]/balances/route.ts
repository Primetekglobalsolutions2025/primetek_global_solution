import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let { data: balances, error } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', id)
      .eq('leave_type', 'Casual')
      .eq('year', currentYear)
      .eq('month', currentMonth);

    if (error) throw error;

    // Self-healing initialization if current month balance doesn't exist
    if (!balances || balances.length === 0) {
      const { data: config } = await supabaseAdmin
        .from('portal_config')
        .select('config_value')
        .eq('config_key', 'default_casual_leave')
        .maybeSingle();

      const defaultCL = config ? parseInt(config.config_value) : 1;

      const { data: newBalances, error: initError } = await supabaseAdmin
        .from('leave_balances')
        .insert([{
          employee_id: id,
          leave_type: 'Casual',
          total_days: defaultCL,
          used_days: 0,
          year: currentYear,
          month: currentMonth
        }])
        .select();

      if (initError) throw initError;
      balances = newBalances || [];
    }

    return NextResponse.json({ balances });
  } catch (error) {
    console.error('Error fetching balances:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const casual = typeof body.casual === 'number' ? body.casual : parseInt(body.casual) || 0;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Check if balance exists
    const { data: existing } = await supabaseAdmin
      .from('leave_balances')
      .select('id')
      .eq('employee_id', id)
      .eq('leave_type', 'Casual')
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('leave_balances')
        .update({ total_days: casual })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('leave_balances')
        .insert({
          employee_id: id,
          leave_type: 'Casual',
          total_days: casual,
          used_days: 0,
          year: currentYear,
          month: currentMonth
        });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating balance:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
