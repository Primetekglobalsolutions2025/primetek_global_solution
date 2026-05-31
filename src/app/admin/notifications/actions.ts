'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'personal' | 'alert';
  employee_id: string | null;
  sender_name: string;
  is_read: boolean;
  created_at: string;
  employees?: {
    name: string;
    employee_id: string;
  } | null;
}

export async function getSentNotifications() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized', notifications: [] };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only', notifications: [] };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*, employees:employee_id(name, employee_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, notifications: data as SentNotification[] };
  } catch (err) {
    console.error('Error fetching sent notifications:', err);
    return { success: false, error: 'Failed to fetch sent notifications', notifications: [] };
  }
}

export async function createNotification(
  title: string,
  message: string,
  type: 'announcement' | 'personal' | 'alert',
  employeeId?: string | null
) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    // Resolve sender's name (admin/hr employee name)
    let senderName = 'Admin';
    if (session.role === 'hr') {
      const { data: hrEmp } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('id', session.id)
        .single();
      if (hrEmp?.name) senderName = hrEmp.name;
    } else {
      senderName = 'Administrator';
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([{
        title,
        message,
        type,
        employee_id: employeeId || null,
        sender_name: senderName,
        is_read: false
      }])
      .select()
      .single();

    if (error) throw error;

    // Dispatch Web Push notification
    try {
      await dispatchNotification({
        title,
        message,
        type: 'company_announcement',
        employeeId: employeeId || null,
        clickActionUrl: '/employee/dashboard',
        senderName,
        skipInApp: true
      });
    } catch (pushErr: any) {
      console.warn(`[Push Delivery Failed] action: createNotification, error: ${pushErr.message}`);
    }

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');

    return { success: true, notification: data };
  } catch (err) {
    console.error('Error creating notification:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send notification' };
  }
}

export async function deleteNotification(id: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');

    return { success: true };
  } catch (err) {
    console.error('Error deleting notification:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete notification' };
  }
}
