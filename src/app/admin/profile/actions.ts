'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

import bcrypt from 'bcryptjs';

export async function changePassword(data: { currentPassword?: string; newPassword?: string }) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (session.role === 'admin') {
    // Admin password change via Supabase Auth
    if (!data.newPassword) throw new Error('New password is required');
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(session.id, {
      password: data.newPassword,
    });
    if (authError) throw new Error(authError.message);
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
    throw new Error('Employee record not found');
  }

  // 1. Verify current password
  if (data.currentPassword) {
    const isValid = await bcrypt.compare(data.currentPassword, employee.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
  }

  // 2. Hash new password
  if (!data.newPassword) throw new Error('New password is required');
  const newHash = await bcrypt.hash(data.newPassword, 12);

  // 3. Update in DB
  const { error: updateError } = await supabaseAdmin
    .from('employees')
    .update({ password_hash: newHash })
    .eq('id', session.id);

  if (updateError) {
    console.error('Error updating employee password:', updateError instanceof Error ? updateError.message : String(updateError));
    throw new Error('Failed to update password in database');
  }

  revalidatePath('/employee/profile');
  return { success: true };
}
