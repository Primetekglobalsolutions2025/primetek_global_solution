import { supabaseAdmin } from './supabase-admin';
import { getSession } from './auth';

/**
 * Logs a system action to the audit_logs table.
 * Uses supabaseAdmin to bypass RLS since this is a server-side trusted operation.
 */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
 
export async function logAuditAction(
  action: string,
  entityType: string,
  entityId?: string,
  oldData?: any,
  newData?: any,
  overrideUser?: { id: string; role: string }
) {
  try {
    const session = await getSession();
    const userId = overrideUser?.id || session?.id || NIL_UUID;
    const userRole = overrideUser?.role || session?.role || 'system';
 
    const { error } = await supabaseAdmin.rpc('log_action', {
      p_user_id: userId,
      p_user_role: userRole,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_old_data: oldData,
      p_new_data: newData
    });
 
    if (error) {
      console.error('Audit Log Error:', error);
    }
  } catch (err) {
    console.error('Failed to create audit log:', err);
  }
}
