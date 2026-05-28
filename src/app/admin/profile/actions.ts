'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import bcrypt from 'bcryptjs';

export async function changePassword(data: { currentPassword?: string; newPassword?: string }) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (session.role === 'admin') {
    // Admin password change via Supabase Auth
    if (!data.currentPassword) throw new Error('Current password is required');
    if (!data.newPassword) throw new Error('New password is required');

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
      email: session.email,
      password: data.currentPassword,
    });
    if (verifyError) {
      throw new Error('Current password is incorrect');
    }

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

export async function updateAdminProfile(data: { name: string }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  if (!data.name || data.name.trim() === '') {
    throw new Error('Name cannot be empty');
  }

  // 1. Update full_name in Supabase Auth user metadata
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(session.id, {
    user_metadata: { full_name: data.name.trim() }
  });

  if (authError) {
    console.error('Error updating admin profile metadata:', authError);
    throw new Error(authError.message);
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
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  revalidatePath('/admin/profile');
  return { success: true };
}
