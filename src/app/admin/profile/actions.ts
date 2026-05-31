'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

import bcrypt from 'bcryptjs';

export async function changePassword(data: { currentPassword?: string; newPassword?: string }) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    if (session.role === 'admin') {
      await verifyActiveAdmin(session.id);
      // Admin password change via Supabase Auth
      if (!data.currentPassword) {
        return { success: false, error: 'Current password is required' };
      }
      if (!data.newPassword) {
        return { success: false, error: 'New password is required' };
      }

      // Verify current password by attempting to sign in
      // Create a localized client for credentials verification to avoid mutating the global supabaseAdmin client
      const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { error: verifyError } = await authClient.auth.signInWithPassword({
        email: session.email,
        password: data.currentPassword,
      });
      if (verifyError) {
        return { success: false, error: 'Current password is incorrect' };
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(session.id, {
        password: data.newPassword,
      });
      if (authError) {
        return { success: false, error: authError.message };
      }
      revalidatePath('/admin/profile');
      return { success: true };
    }

    // Employee password change logic
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('password_hash')
      .eq('id', session.id)
      .single();

    if (fetchError || !employee) {
      return { success: false, error: 'Employee record not found' };
    }

    // 1. Verify current password
    if (data.currentPassword) {
      const isValid = await bcrypt.compare(data.currentPassword, employee.password_hash);
      if (!isValid) {
        return { success: false, error: 'Current password is incorrect' };
      }
    }

    // 2. Hash new password
    if (!data.newPassword) {
      return { success: false, error: 'New password is required' };
    }
    const newHash = await bcrypt.hash(data.newPassword, 12);

    // 3. Update in DB
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ password_hash: newHash })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error updating employee password:', updateError instanceof Error ? updateError.message : String(updateError));
      return { success: false, error: 'Failed to update password in database' };
    }

    revalidatePath('/employee/profile');
    return { success: true };
  } catch (err: any) {
    console.error('changePassword action crashed:', err);
    return { success: false, error: err.message || 'Failed to change password' };
  }
}

export async function updateAdminProfile(data: { name: string }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

    if (!data.name || data.name.trim() === '') {
      return { success: false, error: 'Name cannot be empty' };
    }

    // 1. Update full_name in Supabase Auth user metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(session.id, {
      user_metadata: { full_name: data.name.trim() }
    });

    if (authError) {
      console.error('Error updating admin profile metadata:', authError);
      return { success: false, error: authError.message };
    }

    // 2. Generate a new JWT token with the updated name
    const { createToken } = await import('@/lib/auth');
    const token = await createToken({
      id: session.id,
      email: session.email,
      role: 'admin',
      name: data.name.trim(),
    });

    // 3. Set the updated cookie
    const cookieStore = await cookies();
    cookieStore.set('admin-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours (admin session lifetime)
    });

    revalidatePath('/admin/profile');
    return { success: true };
  } catch (err: any) {
    console.error('updateAdminProfile crashed:', err);
    return { success: false, error: err.message || 'Failed to update profile' };
  }
}

export async function updateAdminNotificationPreferences(preferences: {
  leave_approval_required: boolean;
  attendance_issues: boolean;
  daily_reports_submitted: boolean;
  new_applications: boolean;
  system_alerts: boolean;
}) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update({ notification_preferences: preferences })
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating admin notification preferences:', error);
      return { success: false, error: 'Failed to update preferences' };
    }

    revalidatePath('/admin/profile');

    return { success: true, preferences: data.notification_preferences };
  } catch (err: any) {
    console.error('updateAdminNotificationPreferences crashed:', err);
    return { success: false, error: err.message || 'Failed to update preferences' };
  }
}
