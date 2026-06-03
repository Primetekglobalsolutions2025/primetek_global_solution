import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/auth';
import { getISTShiftDate } from '@/lib/utils';

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

    const todayStr = getISTShiftDate();

    // Query active attendance session for the employee today
    const { data: record, error } = await supabaseAdmin
      .from('attendance')
      .select('id, status, check_in, check_out')
      .eq('employee_id', payload.id)
      .eq('date', todayStr)
      .maybeSingle();

    if (error) {
      console.error('Session lookup error:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!record || record.check_out || record.status === 'Logged Out') {
      return NextResponse.json({
        success: true,
        sessionActive: false,
        message: 'No active session found. Please clock in first.'
      });
    }

    return NextResponse.json({
      success: true,
      sessionActive: true,
      sessionId: record.id,
      status: record.status
    });
  } catch (err) {
    console.error('Extension Session route error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
