'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
export async function getAdminEmployees() {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching admin employees:', error);
    return [];
  }
  return data;
}

export async function toggleEmployeeStatus(id: string, currentStatus: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  const { error } = await supabaseAdmin
    .from('employees')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    console.error('Error toggling employee status:', error);
    throw new Error('Failed to update status');
  }

  revalidatePath('/admin/employees');
  revalidatePath('/admin/dashboard');
}

export async function createEmployee(data: {
  name: string;
  email: string;
  role: string;
  department: string;
}) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // Generate 10-char employee ID like cmk2028273
  const randomNum = Math.floor(Math.random() * 9000000 + 1000000);
  const employee_id = `cmk${randomNum}`;

  // MED-14: Generate a cryptographically secure random password
  const password = crypto.randomBytes(12).toString('base64url');
  // MED-15: Increase bcrypt cost factor to 12
  const password_hash = await bcrypt.hash(password, 12);

  const { data: newEmp, error } = await supabaseAdmin.from('employees').insert([
    {
      employee_id,
      name: data.name,
      email: data.email.trim().toLowerCase(),
      role: data.role,
      department: data.department,
      designation: data.department,
      password_hash,
      join_date: new Date().toISOString().split('T')[0],
      status: 'Active',
    },
  ]).select('id').single();

  if (error || !newEmp) {
    console.error('Error creating employee:', error);
    throw new Error(error?.message || 'Failed to create employee');
  }

  // Initialize Balances from Portal Config (Casual Leave only for current month)
  const { data: config } = await supabaseAdmin
    .from('portal_config')
    .select('config_value')
    .eq('config_key', 'default_casual_leave')
    .maybeSingle();

  const parsedCasual = config ? parseInt(config.config_value, 10) : 1;
  const casual = isNaN(parsedCasual) || parsedCasual < 0 ? 1 : parsedCasual;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  await supabaseAdmin.from('leave_balances').insert([
    { 
      employee_id: newEmp.id, 
      leave_type: 'Casual', 
      total_days: casual, 
      used_days: 0, 
      year: currentYear, 
      month: currentMonth 
    },
  ]);

  revalidatePath('/admin/employees');
  revalidatePath('/admin/dashboard');
  return { success: true, employee_id, password };
}

export async function deleteEmployee(id: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { error } = await supabaseAdmin
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting employee:', error);
    throw new Error('Failed to delete employee');
  }

  revalidatePath('/admin/employees');
  revalidatePath('/admin/dashboard');
}
