'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'personal' | 'alert';
  employee_id: string | null;
  sender_name: string;
  is_read: boolean;
  is_pinned: boolean;
  created_at: string;
}

export async function getNotificationsForEmployee(employeeId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized', notifications: [] };
    if (session.id !== employeeId) return { success: false, error: 'BOLA Block: ID mismatch', notifications: [] };

    // 1. Fetch all notifications matching employee (broadcast or specific)
    const { data: notifs, error: notifsErr } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .or(`employee_id.is.null,employee_id.eq.${employeeId}`)
      .order('created_at', { ascending: false });

    if (notifsErr) throw notifsErr;

    // 2. Fetch read broadcast notification IDs for this employee
    const { data: reads, error: readsErr } = await supabaseAdmin
      .from('notification_reads')
      .select('notification_id')
      .eq('employee_id', employeeId);

    if (readsErr) throw readsErr;

    const readIds = new Set((reads || []).map((r: any) => r.notification_id));

    // 3. Filter by 3-day expiry (unless pinned)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const activeNotifs = (notifs || []).filter((n: any) => {
      if (n.is_pinned) return true;
      return new Date(n.created_at) >= threeDaysAgo;
    });

    // 4. Map notifications and calculate is_read
    const notifications: AppNotification[] = activeNotifs.map((n: any) => {
      const isBroadcast = n.employee_id === null;
      const isRead = isBroadcast ? readIds.has(n.id) : n.is_read;

      return {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'announcement',
        employee_id: n.employee_id,
        sender_name: n.sender_name || 'Admin',
        is_read: isRead,
        is_pinned: n.is_pinned || false,
        created_at: n.created_at
      };
    });

    return { success: true, notifications };
  } catch (err) {
    console.error('Error fetching employee notifications:', err);
    return { success: false, error: 'Failed to load notifications', notifications: [] };
  }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    if (session.id !== userId) return { success: false, error: 'BOLA Block: ID mismatch' };

    const isAdmin = session.role === 'admin' || session.role === 'hr';

    // Fetch the notification to check type
    const { data: notif, error: fetchErr } = await supabaseAdmin
      .from('notifications')
      .select('employee_id, admin_id, is_for_admin')
      .eq('id', notificationId)
      .single();

    if (fetchErr || !notif) throw new Error('Notification not found');

    if (isAdmin) {
      if (notif.admin_id !== null) {
        // Targeted notification: update RLS row directly
        const { error } = await supabaseAdmin
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
        if (error) throw error;
      } else {
        // Broadcast / admin-wide notification: insert read log
        const { data: existingRead } = await supabaseAdmin
          .from('notification_reads')
          .select('notification_id')
          .eq('notification_id', notificationId)
          .eq('admin_id', userId)
          .maybeSingle();

        if (!existingRead) {
          const { error } = await supabaseAdmin
            .from('notification_reads')
            .insert({
              notification_id: notificationId,
              admin_id: userId,
              employee_id: null
            });
          if (error) throw error;
        }
      }
    } else {
      if (notif.employee_id !== null) {
        // Targeted notification: update RLS row directly
        const { error } = await supabaseAdmin
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
        if (error) throw error;
      } else {
        // Broadcast notification: insert read log
        const { data: existingRead } = await supabaseAdmin
          .from('notification_reads')
          .select('notification_id')
          .eq('notification_id', notificationId)
          .eq('employee_id', userId)
          .maybeSingle();

        if (!existingRead) {
          const { error } = await supabaseAdmin
            .from('notification_reads')
            .insert({
              notification_id: notificationId,
              employee_id: userId,
              admin_id: null
            });
          if (error) throw error;
        }
      }
    }

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (err) {
    console.error('Error marking notification read:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update notification' };
  }
}

export async function markAllNotificationsRead(employeeId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    if (session.id !== employeeId) return { success: false, error: 'BOLA Block: ID mismatch' };

    // Fetch all unread notifications
    const res = await getNotificationsForEmployee(employeeId);
    if (!res.success) throw new Error(res.error);

    const unread = res.notifications.filter(n => !n.is_read);
    if (unread.length === 0) return { success: true };

    const targetedIds = unread.filter(n => n.employee_id !== null).map(n => n.id);
    const broadcastIds = unread.filter(n => n.employee_id === null).map(n => n.id);

    // 1. Bulk update targeted ones
    if (targetedIds.length > 0) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .in('id', targetedIds);
      if (error) throw error;
    }

    // 2. Bulk insert broadcast reads
    if (broadcastIds.length > 0) {
      const insertRows = broadcastIds.map(id => ({
        notification_id: id,
        employee_id: employeeId
      }));

      const { error } = await supabaseAdmin
        .from('notification_reads')
        .insert(insertRows);
      if (error) throw error;
    }

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    return { success: true };
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update notifications' };
  }
}
