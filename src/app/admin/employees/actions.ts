'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getSession, verifyActiveAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { leaveBalancesSchema } from '@/lib/validations';

export async function getAdminEmployees(
  page: number = 1,
  pageSize: number = 100,
  search: string = '',
  department: string = 'all'
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  // Query counts and departments concurrently for performance
  const [
    totalRes,
    activeRes,
    deptsRes
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
    supabaseAdmin.from('employees').select('department').not('department', 'is', null)
  ]);

  const total = totalRes.count || 0;
  const active = activeRes.count || 0;
  const inactive = total - active;
  const departmentsList = Array.from(new Set((deptsRes.data || []).map(d => d.department).filter(Boolean))).sort() as string[];

  // Query paginated and filtered list of employees
  let query = supabaseAdmin
    .from('employees')
    .select('id, employee_id, name, email, role, department, status, join_date, avatar_url, mfa_enabled', { count: 'exact' });

  if (department && department !== 'all') {
    query = query.eq('department', department);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const start = (page - 1) * pageSize;
  const end = page * pageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) {
    console.error('Error fetching admin employees:', error);
    return {
      data: [],
      count: 0,
      totalPages: 0,
      currentPage: page,
      stats: { total, active, inactive },
      departments: departmentsList
    };
  }

  const totalPages = Math.ceil((count || 0) / pageSize) || 1;

  return {
    data: data || [],
    count: count || 0,
    totalPages,
    currentPage: page,
    stats: { total, active, inactive },
    departments: departmentsList
  };
}

export async function toggleEmployeeStatus(id: string, currentStatus: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

    // Fetch current employee data for audit logs
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('name, email')
      .eq('id', id)
      .single();

    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const { error } = await supabaseAdmin
      .from('employees')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Error toggling employee status:', error);
      return { success: false, error: 'Failed to update status' };
    }

    if (employee) {
      await logAuditAction('TOGGLE_EMPLOYEE_STATUS', 'employees', id, { status: currentStatus, name: employee.name, email: employee.email }, { status: newStatus });
    }

    revalidatePath('/admin/employees');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('toggleEmployeeStatus crashed:', err);
    return { success: false, error: err.message || 'Failed to update status' };
  }
}

export async function createEmployee(data: {
  name: string;
  email: string;
  role: string;
  department: string;
}) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

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
      return { success: false, error: error?.message || 'Failed to create employee' };
    }

    // Initialize Balances (Casual Leave only for current month, default is 1 day, does not carry forward)
    const casual = 1;
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

    await logAuditAction('CREATE_EMPLOYEE', 'employees', newEmp.id, null, {
      employee_id,
      name: data.name,
      email: data.email.trim().toLowerCase(),
      role: data.role,
      department: data.department,
      status: 'Active'
    });

    revalidatePath('/admin/employees');
    revalidatePath('/admin/dashboard');
    return { success: true, employee_id, password };
  } catch (err: any) {
    console.error('createEmployee crashed:', err);
    return { success: false, error: err.message || 'Failed to create employee' };
  }
}

export async function deleteEmployee(id: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

    // Fetch employee details before deleting for audit log
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('employee_id, name, email, role, department')
      .eq('id', id)
      .single();

    // Cascade cleanup for unconstrained tables
    await supabaseAdmin.from('active_sessions').delete().eq('user_id', id);
    await supabaseAdmin.from('trusted_devices').delete().eq('user_id', id);
    await supabaseAdmin.from('attendance_risk_events').delete().eq('employee_id', id);

    const { error } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting employee:', error);
      return { success: false, error: 'Failed to delete employee' };
    }

    if (employee) {
      await logAuditAction('DELETE_EMPLOYEE', 'employees', id, employee, null);
    }

    revalidatePath('/admin/employees');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('deleteEmployee crashed:', err);
    return { success: false, error: err.message || 'Failed to delete employee' };
  }
}

export async function resetEmployeeMFA(id: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('name, email')
      .eq('id', id)
      .single();

    const { error } = await supabaseAdmin
      .from('employees')
      .update({ mfa_enabled: false, mfa_secret: null })
      .eq('id', id);

    if (error) {
      console.error('Error resetting employee MFA:', error);
      return { success: false, error: 'Failed to reset MFA' };
    }

    if (employee) {
      await logAuditAction('RESET_EMPLOYEE_MFA', 'employees', id, { email: employee.email, name: employee.name }, null);
    }

    revalidatePath('/admin/employees');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('resetEmployeeMFA crashed:', err);
    return { success: false, error: err.message || 'Failed to reset MFA' };
  }
}

export async function getEmployeeBalances(employeeId: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') throw new Error('Unauthorized');

  const { data: balances, error } = await supabaseAdmin
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Error fetching employee leave balances:', error);
    return [];
  }
  return balances;
}

export async function updateEmployeeBalances(employeeId: string, balances: { sick: number; casual: number; earned: number }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin' || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveAdmin(session.id);

    // Validate balance values to prevent malicious input using schema
    const parsed = leaveBalancesSchema.safeParse(balances);
    if (!parsed.success) {
      const msg = `Invalid balance values: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`;
      return { success: false, error: msg };
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // We update or insert each type
    const types = [
      { type: 'Sick', val: balances.sick },
      { type: 'Casual', val: balances.casual },
      { type: 'Earned', val: balances.earned },
    ];

    for (const t of types) {
      // Check if balance exists
      const { data: existing } = await supabaseAdmin
        .from('leave_balances')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('leave_type', t.type)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from('leave_balances')
          .update({ total_days: t.val })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from('leave_balances')
          .insert({
            employee_id: employeeId,
            leave_type: t.type,
            total_days: t.val,
            used_days: 0,
            year: currentYear,
            month: t.type === 'Casual' ? currentMonth : null,
          });
        if (error) throw error;
      }
    }

    await logAuditAction('UPDATE_LEAVE_BALANCES', 'leave_balances', employeeId, null, balances);

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (err: any) {
    console.error('updateEmployeeBalances crashed:', err);
    return { success: false, error: err.message || 'Failed to update leave balances' };
  }
}

