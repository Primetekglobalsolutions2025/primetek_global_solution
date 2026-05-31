import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1)
    })
  }),
  deviceName: z.string().optional().nullable(),
  browserType: z.string().optional().nullable()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown-ip';
    const rateResult = await consumeRateLimit(apiRateLimiter, ip);
    if (!rateResult.allowed) {
      const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    // 2. Authentication
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Request Validation
    const body = await request.json();
    const validated = subscriptionSchema.parse(body);

    const isUserAdmin = session.role === 'admin' || session.role === 'hr';

    // 4. Broken Object Level Authorization (BOLA) Check & DB Upsert
    const upsertPayload: Record<string, any> = {
      endpoint: validated.subscription.endpoint,
      p256dh: validated.subscription.keys.p256dh,
      auth: validated.subscription.keys.auth,
      device_name: validated.deviceName || null,
      browser_type: validated.browserType || null,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    if (isUserAdmin) {
      // Admin verification
      const { data: adminRecord, error: adminErr } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('id', session.id)
        .maybeSingle();

      if (adminErr || !adminRecord) {
        return NextResponse.json({ error: 'Admin account not found' }, { status: 403 });
      }

      upsertPayload.admin_id = session.id;
      upsertPayload.employee_id = null;
    } else {
      // Employee verification
      const { data: employeeRecord, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('id', session.id)
        .maybeSingle();

      if (empErr || !employeeRecord) {
        return NextResponse.json({ error: 'Employee account not found' }, { status: 403 });
      }

      upsertPayload.employee_id = session.id;
      upsertPayload.admin_id = null;
    }

    const { error: upsertError } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(upsertPayload, { onConflict: 'endpoint' });

    if (upsertError) {
      console.error('Failed to register push subscription:', upsertError);
      throw upsertError;
    }

    return NextResponse.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: err.issues }, { status: 400 });
    }
    console.error('Push subscribe error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
