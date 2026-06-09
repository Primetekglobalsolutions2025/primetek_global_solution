import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken, verifyActiveAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate Admin/HR
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Check role: must be admin or hr
    if (payload.role !== 'admin' && payload.role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden: Admin or HR access required' }, { status: 403 });
    }

    // Verify session active in admin_users or employee session depending on role
    if (payload.role === 'admin') {
      try {
        await verifyActiveAdmin(payload.id);
      } catch (adminErr: any) {
        return NextResponse.json({ error: adminErr.message || 'Unauthorized admin session' }, { status: 401 });
      }
    }

    // 2. Status Engine State Transitions & Stale Cleanup
    // Run cleanup for records >5 minutes old
    const { error: cleanupError } = await supabaseAdmin.rpc('cleanup_stale_presence');
    if (cleanupError) {
      console.warn('[Presence/Live] cleanup_stale_presence RPC warning:', cleanupError.message);
    }

    const now = new Date();
    const ninetySecondsAgo = new Date(now.getTime() - 90 * 1000).toISOString();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    // Mark as offline if no heartbeat for >90 seconds
    const { error: offlineErr } = await supabaseAdmin
      .from('employee_presence')
      .update({ status: 'offline' })
      .lt('last_heartbeat', ninetySecondsAgo)
      .neq('status', 'offline');

    if (offlineErr) {
      console.error('[Presence/Live] Failed to update offline states:', offlineErr.message);
    }

    // Mark as idle if no activity for >5 minutes (and currently working)
    const { error: idleErr } = await supabaseAdmin
      .from('employee_presence')
      .update({ status: 'idle' })
      .lt('last_activity', fiveMinutesAgo)
      .eq('status', 'working');

    if (idleErr) {
      console.error('[Presence/Live] Failed to update idle states:', idleErr.message);
    }

    // 3. Fetch all active employees and left join their presence records
    const { data: employeesData, error: fetchErr } = await supabaseAdmin
      .from('employees')
      .select(`
        id,
        name,
        role,
        department,
        status,
        employee_presence (
          status,
          last_activity,
          last_heartbeat,
          break_started_at,
          updated_at
        )
      `)
      .eq('status', 'Active');

    if (fetchErr) {
      console.error('[Presence/Live] Fetch employees error:', fetchErr.message);
      return NextResponse.json({ error: 'Failed to fetch presence data' }, { status: 500 });
    }

    // Format the result as a list of EmployeePresence objects
    const formattedPresence = (employeesData || []).map((emp: any) => {
      // Supabase returns 1-to-1 relations either as an object or an array of 1 object
      const presence = Array.isArray(emp.employee_presence) 
        ? emp.employee_presence[0] 
        : emp.employee_presence;

      return {
        employee_id: emp.id,
        status: presence?.status || 'offline',
        last_activity: presence?.last_activity || null,
        last_heartbeat: presence?.last_heartbeat || null,
        break_started_at: presence?.break_started_at || null,
        updated_at: presence?.updated_at || null,
        employees: {
          name: emp.name,
          role: emp.role,
          department: emp.department
        }
      };
    });

    // Return response with JSON and caching headers disabled
    return new Response(JSON.stringify(formattedPresence), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    console.error('[Presence/Live] Server error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
