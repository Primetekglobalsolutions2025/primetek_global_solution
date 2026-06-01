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
  is_pinned: boolean;
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

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoIso = threeDaysAgo.toISOString();

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*, employees:employee_id(name, employee_id)')
      .or(`is_pinned.eq.true,created_at.gte.${threeDaysAgoIso}`)
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

export async function updateNotification(
  id: string,
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

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        title,
        message,
        type,
        employee_id: employeeId || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');

    return { success: true, notification: data };
  } catch (err) {
    console.error('Error updating notification:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update notification' };
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

export async function togglePinNotification(id: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    const { data: notif, error: fetchErr } = await supabaseAdmin
      .from('notifications')
      .select('is_pinned')
      .eq('id', id)
      .single();

    if (fetchErr || !notif) throw new Error('Notification not found');

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_pinned: !notif.is_pinned })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');

    return { success: true, isPinned: !notif.is_pinned };
  } catch (err) {
    console.error('Error toggling pin state:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to toggle pin state' };
  }
}

export async function deleteMultipleNotifications(ids: string[]) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    if (!ids || ids.length === 0) return { success: true };

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .in('id', ids);

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');

    return { success: true };
  } catch (err) {
    console.error('Error deleting multiple notifications:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete notifications' };
  }
}

export async function cleanupExpiredNotifications() {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoIso = threeDaysAgo.toISOString();

    const { error, count } = await supabaseAdmin
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('is_pinned', false)
      .lt('created_at', threeDaysAgoIso);

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/notifications');

    return { success: true, deletedCount: count || 0 };
  } catch (err) {
    console.error('Error cleaning up notifications:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to run cleanup' };
  }
}

export async function getNotificationsForAdmin(adminId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized', notifications: [] };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only', notifications: [] };

    // 1. Fetch all notifications matching admin (broadcast/admin-wide or specific admin)
    const { data: notifs, error: notifsErr } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .or(`is_for_admin.eq.true,admin_id.eq.${adminId}`)
      .order('created_at', { ascending: false });

    if (notifsErr) throw notifsErr;

    // 2. Fetch read broadcast/admin-wide notification IDs for this admin
    const { data: reads, error: readsErr } = await supabaseAdmin
      .from('notification_reads')
      .select('notification_id')
      .eq('admin_id', adminId);

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
    const notifications = activeNotifs.map((n: any) => {
      const isBroadcast = n.admin_id === null;
      const isRead = isBroadcast ? readIds.has(n.id) : n.is_read;

      return {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'announcement',
        admin_id: n.admin_id,
        sender_name: n.sender_name || 'System',
        is_read: isRead,
        is_pinned: n.is_pinned || false,
        created_at: n.created_at
      };
    });

    return { success: true, notifications };
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    return { success: false, error: 'Failed to load notifications', notifications: [] };
  }
}

export async function markAllAdminNotificationsRead(adminId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    // Fetch all unread notifications for admin
    const res = await getNotificationsForAdmin(adminId);
    if (!res.success) throw new Error(res.error);

    const unread = res.notifications.filter(n => !n.is_read);
    if (unread.length === 0) return { success: true };

    const targetedIds = unread.filter(n => n.admin_id !== null).map(n => n.id);
    const broadcastIds = unread.filter(n => n.admin_id === null).map(n => n.id);

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
        admin_id: adminId,
        employee_id: null
      }));

      const { error } = await supabaseAdmin
        .from('notification_reads')
        .insert(insertRows);
      if (error) throw error;
    }

    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (err) {
    console.error('Error marking all admin notifications read:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update notifications' };
  }
}
