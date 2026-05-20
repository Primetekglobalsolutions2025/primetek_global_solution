'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { calculateDistance } from '@/lib/utils';

// Helper to get current IST time
function getISTDate() {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
  return new Date(now.getTime() + offset);
}

export async function checkIn(lat: number, lng: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // --- Safety Feature: Close any stale sessions from previous days ---
    const { data: stale } = await supabaseAdmin
      .from('attendance')
      .select('id, check_in')
      .eq('employee_id', session.id)
      .is('check_out', null)
      .neq('date', getISTDate().toISOString().split('T')[0]);

    if (stale && stale.length > 0) {
      for (const record of stale) {
        const checkInTime = new Date(record.check_in);
        const autoOut = new Date(checkInTime.getTime() + 9 * 60 * 60 * 1000);
        await supabaseAdmin
          .from('attendance')
          .update({ check_out: autoOut.toISOString() })
          .eq('id', record.id);
      }
    }

    // 1. Get Office Location
    const { data: officeList } = await supabaseAdmin
      .from('office_locations')
      .select('name, lat, lng, radius_meters')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const office = officeList && officeList.length > 0 ? officeList[0] : null;

    const officeLat = Number(office?.lat || 17.3850);
    const officeLng = Number(office?.lng || 78.4867);
    const radius = Number(office?.radius_meters || 500);
    const officeName = office?.name || 'HQ';

    // 2. GPS Validation
    const distance = calculateDistance(lat, lng, officeLat, officeLng);
    
    if (distance > radius) {
      return { 
        success: false, 
        outOfRadius: true,
        distance: Math.round(distance),
        officeName
      };
    }

    // 3. Check for existing record
    const istNow = getISTDate();
    const todayStr = istNow.toISOString().split('T')[0];

    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id, check_out, status')
      .eq('employee_id', session.id)
      .eq('date', todayStr)
      .maybeSingle();

    if (existing) {
      if (existing.check_out) return { success: false, error: 'Completed for today' };
      return { success: false, error: `Already ${existing.status.toLowerCase()}` };
    }

    // 4. Record Check-in
    const hours = istNow.getUTCHours();
    const minutes = istNow.getUTCMinutes();
    const isLate = hours > 9 || (hours === 9 && minutes > 30);

    const { error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        employee_id: session.id,
        date: todayStr,
        check_in: new Date().toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        status: isLate ? 'Late' : 'Present',
      }]);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Internal server error' };
  }
}

export async function requestWFH(lat: number, lng: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const istNow = getISTDate();
    const todayStr = istNow.toISOString().split('T')[0];

    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('employee_id', session.id)
      .eq('date', todayStr)
      .maybeSingle();

    if (existing) return { success: false, error: 'Already exists for today' };

    const { error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        employee_id: session.id,
        date: todayStr,
        check_in: new Date().toISOString(),
        lat: Number(lat),
        lng: Number(lng),
        status: 'Pending WFH',
      }]);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Failed to request WFH' };
  }
}

export async function checkOut(recordId: string, lat: number, lng: number) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    // Fetch the check-in time to compute duration
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('check_in')
      .eq('id', recordId)
      .single();

    if (fetchError || !record || !record.check_in) {
      return { success: false, error: 'Attendance check-in record not found' };
    }

    const checkInTime = new Date(record.check_in).getTime();
    const checkOutTime = Date.now();
    const durationHours = Number(((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2));

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({
        check_out: new Date(checkOutTime).toISOString(),
        duration_hours: durationHours,
        lat: Number(lat),
        lng: Number(lng),
      })
      .eq('id', recordId)
      .eq('employee_id', session.id);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Internal server error' };
  }
}

export async function resumeSession(recordId: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) return { success: false, error: 'Unauthorized' };

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ check_out: null })
      .eq('id', recordId)
      .eq('employee_id', session.id);

    if (error) throw error;

    revalidatePath('/employee/attendance');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Failed to resume session' };
  }
}
