import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => null);
    if (!body || !body.sessionId || body.sequenceNumber === undefined) {
      return NextResponse.json({ error: 'Invalid payload: missing sessionId or sequenceNumber' }, { status: 400 });
    }

    const { sessionId, sequenceNumber, activeWindow, clicks, keypresses, pointerMoves } = body;

    // Resolve client IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // Verify session belongs to the employee and is currently active
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('id, status, check_out')
      .eq('id', sessionId)
      .eq('employee_id', payload.id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (record.check_out || record.status === 'Logged Out') {
      return NextResponse.json({ error: 'Session is clocked out' }, { status: 400 });
    }

    // Determine event details
    const eventType = activeWindow ? 'HEARTBEAT_RECEIVED' : 'IDLE_DETECTED';
    const status = activeWindow ? 'Working' : 'Idle';
    const idempotencyKey = `ext-hb:${sessionId}:${sequenceNumber}`;

    // Invoke Postgres transactional writer RPC
    const { error: rpcError } = await supabaseAdmin.rpc('write_heartbeat_event', {
      p_session_id: sessionId,
      p_employee_id: payload.id,
      p_event_type: eventType,
      p_sequence: sequenceNumber,
      p_idempotency: idempotencyKey,
      p_client_ip: clientIp,
      p_lat: null,
      p_lng: null,
      p_accuracy: null,
      p_status: status,
      p_payload: {
        source: 'chrome-extension',
        telemetry: {
          clicks: clicks || 0,
          keypresses: keypresses || 0,
          pointer_moves: pointerMoves || 0
        }
      }
    });

    if (rpcError) {
      console.error('Extension heartbeat RPC failed:', rpcError.message);
      return NextResponse.json({ error: 'Failed to record heartbeat' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('Extension Heartbeat route error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
