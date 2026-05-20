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

    const { data: balances, error } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', id);

    if (error) throw error;

    return NextResponse.json({ balances });
  } catch (error) {
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

    const { sick, casual, earned } = await req.json();

    const updates = [
      { employee_id: id, leave_type: 'Sick', total_days: sick, used_days: 0 },
      { employee_id: id, leave_type: 'Casual', total_days: casual, used_days: 0 },
      { employee_id: id, leave_type: 'Earned', total_days: earned, used_days: 0 },
    ];

    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('leave_balances')
        .upsert(update, { onConflict: 'employee_id,leave_type' });
      
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
