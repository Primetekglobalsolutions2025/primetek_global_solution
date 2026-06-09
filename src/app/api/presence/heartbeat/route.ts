import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/auth';
import { presenceRateLimiter, consumeRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const heartbeatSchema = z.object({
  employeeId: z.string().uuid(),
  status: z.enum(['working', 'idle', 'break']),
  lastActivity: z.number().int().positive() // Timestamp in milliseconds
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. JWT Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 2. Validate Payload
    const body = await request.json().catch(() => null);
    const parseResult = heartbeatSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parseResult.error.format() }, { status: 400 });
    }

    const { employeeId, status, lastActivity } = parseResult.data;

    // Security check: Employees can only report their own presence
    if (employeeId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot update other employee presence' }, { status: 403 });
    }

    // 3. Rate Limiting (Max 3 heartbeats per minute per employee)
    const rateLimitKey = employeeId;
    const rateLimitCheck = await consumeRateLimit(presenceRateLimiter, rateLimitKey);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded: Max 3 heartbeats per minute' }, { status: 429 });
    }

    // Convert lastActivity timestamp (ms) to ISO string
    const lastActivityDate = new Date(lastActivity).toISOString();
    const nowIso = new Date().toISOString();

    // Check if there is an existing presence record to preserve or set break_started_at
    const { data: existingRecord } = await supabaseAdmin
      .from('employee_presence')
      .select('status, break_started_at')
      .eq('employee_id', employeeId)
      .maybeSingle();

    let breakStartedAt: string | null = null;
    if (status === 'break') {
      // Preserve existing break timestamp or set new one
      breakStartedAt = existingRecord?.status === 'break' && existingRecord.break_started_at 
        ? existingRecord.break_started_at 
        : nowIso;
    }

    // 4. UPSERT presence record (Single row per employee)
    const { error: upsertError } = await supabaseAdmin
      .from('employee_presence')
      .upsert({
        employee_id: employeeId,
        status,
        last_activity: lastActivityDate,
        last_heartbeat: nowIso,
        break_started_at: breakStartedAt,
        updated_at: nowIso
      });

    if (upsertError) {
      console.error('[Presence/Heartbeat] DB Upsert error:', upsertError.message);
      return NextResponse.json({ error: 'Failed to update presence status' }, { status: 500 });
    }

    // Return compressed/minimal payload
    return new Response(JSON.stringify({ success: true, status }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    console.error('[Presence/Heartbeat] Server error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
