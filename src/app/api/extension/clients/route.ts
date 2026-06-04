import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    // Query application profiles assigned to this employee
    const { data: profiles, error } = await supabaseAdmin
      .from('application_profiles')
      .select('id, client_name, client_role, status')
      .eq('assigned_to', payload.id);

    if (error) {
      console.error('Extension clients query error:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      clients: profiles || []
    });
  } catch (err) {
    console.error('Extension Clients route error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
