import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { inquirySchema } from '@/lib/validations';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit public submissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as any).ip || 'unknown-ip';
    const rateResult = await consumeRateLimit(apiRateLimiter, ip);
    if (!rateResult.allowed) {
      const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const body = await request.json();
    const validated = inquirySchema.parse(body);

    const { error } = await supabaseAdmin
      .from('inquiries')
      .insert([
        {
          name: validated.name,
          email: validated.email,
          phone: validated.phone || null,
          company: validated.company || null,
          message: validated.requirement,
          status: 'new'
        }
      ]);

    if (error) throw error;

    // Trigger notification to admin
    try {
      const { getAdminInquiryTemplate, notifyAdminsIfEnabled } = await import('@/lib/notifications');
      const html = getAdminInquiryTemplate(
        validated.name,
        validated.email,
        validated.phone || null,
        validated.company || null,
        validated.requirement
      );
      await notifyAdminsIfEnabled('notif_inquiry', `New Contact Inquiry - ${validated.name}`, html);

      const { dispatchNotification } = await import('@/lib/notifications/dispatch');
      await dispatchNotification({
        title: `📞 New Contact Inquiry - ${validated.name}`,
        message: `${validated.name} from ${validated.company || 'Private'} submitted a new inquiry.`,
        type: 'inquiry',
        clickActionUrl: '/admin/inquiries',
        senderName: validated.name
      });
    } catch (notifErr) {
      console.error('Failed to send contact inquiry notification:', notifErr);
    }

    return NextResponse.json(
      { success: true, message: 'Inquiry received successfully' },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: err.issues },
        { status: 400 }
      );
    }
    console.error('Inquiry submission error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const { data, error, count } = await supabaseAdmin
      .from('inquiries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ data, total: count });
  } catch (err) {
    console.error('Error fetching inquiries:', err);
    return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}
