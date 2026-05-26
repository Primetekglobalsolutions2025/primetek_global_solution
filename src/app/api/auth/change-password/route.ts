import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 });
    }

    // Admin Password Change (via Supabase Auth)
    if (session.role === 'admin') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(session.id, {
        password: newPassword
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Admin password updated successfully' });
    }

    // Employee Password Change (via database)
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('password_hash')
      .eq('id', session.id)
      .single();

    if (fetchError || !employee) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValidCurrent = await bcrypt.compare(currentPassword, employee.password_hash);
    if (!isValidCurrent) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ password_hash: newHash })
      .eq('id', session.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Password change error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
