'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';

export interface Holiday {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'Company Holiday' | 'Optional Holiday' | 'Public Holiday';
  created_at?: string;
  updated_at?: string;
}

export async function getHolidays() {
  try {
    const { data, error } = await supabaseAdmin
      .from('holidays')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    
    // Format the date to string YYYY-MM-DD
    const holidays: Holiday[] = (data || []).map((h: any) => ({
      id: h.id,
      title: h.title,
      date: typeof h.date === 'string' ? h.date : new Date(h.date).toISOString().split('T')[0],
      type: h.type
    }));

    return { success: true, holidays };
  } catch (err) {
    console.error('Error fetching holidays:', err);
    return { success: false, error: 'Failed to fetch holidays', holidays: [] };
  }
}

export async function addHoliday(
  title: string, 
  date: string, 
  type: 'Company Holiday' | 'Optional Holiday' | 'Public Holiday'
) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    const { data, error } = await supabaseAdmin
      .from('holidays')
      .insert([{ title, date, type }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A holiday is already scheduled on this date.' };
      }
      throw error;
    }

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/holidays');
    
    return { success: true, holiday: data };
  } catch (err) {
    console.error('Error adding holiday:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to add holiday' };
  }
}

export async function deleteHoliday(id: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };
    const isAdmin = session.role === 'admin' || session.role === 'hr';
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admins only' };

    const { error } = await supabaseAdmin
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/attendance');
    revalidatePath('/admin/holidays');

    return { success: true };
  } catch (err) {
    console.error('Error deleting holiday:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete holiday' };
  }
}
