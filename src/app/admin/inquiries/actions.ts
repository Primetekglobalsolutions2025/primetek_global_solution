'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export async function getAdminInquiries(limit = 200, offset = 0) {
  const session = await getSession();
  if (!session || session.role !== 'admin' || !session.id) throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching admin inquiries:', error);
    return [];
  }
  return data;
}

export async function updateInquiryStatus(id: string, status: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  // Validate status against allowlist to prevent arbitrary values
  const VALID_STATUSES = ['new', 'contacted', 'qualified', 'closed'];
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Fetch current inquiry status for audit trail
  const { data: inquiry } = await supabaseAdmin
    .from('inquiries')
    .select('status, name, email')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('inquiries')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating inquiry status:', error);
    throw new Error('Failed to update status');
  }

  if (inquiry) {
    await logAuditAction(
      'UPDATE_INQUIRY_STATUS',
      'inquiries',
      id,
      { status: inquiry.status, name: inquiry.name, email: inquiry.email },
      { status }
    );
  }

  revalidatePath('/admin/inquiries');
  revalidatePath('/admin/dashboard');
}

export async function deleteInquiry(id: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');
  await verifyActiveAdmin(session.id);

  // Fetch inquiry details before deletion for audit trail
  const { data: inquiry } = await supabaseAdmin
    .from('inquiries')
    .select('name, email, message')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('inquiries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting inquiry:', error);
    throw new Error('Failed to delete inquiry');
  }

  if (inquiry) {
    await logAuditAction('DELETE_INQUIRY', 'inquiries', id, inquiry, null);
  }

  revalidatePath('/admin/inquiries');
  revalidatePath('/admin/dashboard');
}
