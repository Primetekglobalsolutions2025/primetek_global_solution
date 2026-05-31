import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

const unsubscribeSchema = z.object({
  endpoint: z.string().url()
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
    const validated = unsubscribeSchema.parse(body);

    const isUserAdmin = session.role === 'admin' || session.role === 'hr';

    // 4. Secure deletion ensuring user ownership (BOLA prevention)
    let deleteQuery = supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', validated.endpoint);

    if (isUserAdmin) {
      deleteQuery = deleteQuery.eq('admin_id', session.id);
    } else {
      deleteQuery = deleteQuery.eq('employee_id', session.id);
    }

    const { error: deleteError, count } = await deleteQuery.select();

    if (deleteError) {
      console.error('Failed to unregister push subscription:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Push subscription unregistered successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: err.issues }, { status: 400 });
    }
    console.error('Push unsubscribe error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
