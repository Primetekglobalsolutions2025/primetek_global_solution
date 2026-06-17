import { supabaseAdmin } from './supabase-admin';
import { getSession } from './auth';
import { headers } from 'next/headers';

/**
 * Logs a system action to the audit_logs table.
 * Uses supabaseAdmin to bypass RLS since this is a server-side trusted operation.
 */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
 
export async function logAuditAction(
  action: string,
  entityType: string,
  entityId?: string,
  oldData?: unknown,
  newData?: unknown,
  overrideUser?: { id: string; role: string }
) {
  try {
    const session = await getSession();
    const userId = overrideUser?.id || session?.id || NIL_UUID;
    const userRole = overrideUser?.role || session?.role || 'system';
 
    let correlationId: string | null = null;
    try {
      const reqHeaders = await headers();
      correlationId = reqHeaders.get('x-correlation-id');
    } catch {
      // headers() can throw when invoked outside request context
    }

    let finalNewData = newData;
    if (correlationId) {
      if (typeof finalNewData === 'object' && finalNewData !== null) {
        finalNewData = { ...(finalNewData as Record<string, unknown>), _correlation_id: correlationId };
      } else if (finalNewData === undefined || finalNewData === null) {
        finalNewData = { _correlation_id: correlationId };
      }
    }

    const { error } = await supabaseAdmin.rpc('log_action', {
      p_user_id: userId,
      p_user_role: userRole,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_old_data: oldData,
      p_new_data: finalNewData
    });
 
    if (error) {
      console.error('Audit Log Error:', error);
    }
  } catch (err) {
    console.error('Failed to create audit log:', err);
  }
}
