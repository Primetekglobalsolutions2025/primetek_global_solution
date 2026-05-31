'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession, verifyActiveSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';

import { employeeProfileUpdateSchema } from '@/lib/validations';

export async function updateProfile(name: string, phone: string) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveSession(session.id);

    const parsed = employeeProfileUpdateSchema.safeParse({ name, phone });
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => i.message).join(', ');
      return { success: false, error: `Validation failed: ${issues}` };
    }
    const { name: validatedName, phone: validatedPhone } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from('employees')
      .update({ name: validatedName, phone: validatedPhone })
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: 'Failed to update profile' };
    }

    revalidatePath('/employee/profile');
    revalidatePath('/employee/dashboard');
    
    await logAuditAction(
      'UPDATE_PROFILE',
      'employees',
      session.id,
      null,
      { name: validatedName, phone: validatedPhone }
    );

    return { success: true, employee: data };
  } catch (err: any) {
    console.error('updateProfile crashed:', err);
    return { success: false, error: err.message || 'Failed to update profile' };
  }
}

export async function updateAvatar(formData: FormData) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveSession(session.id);

    const file = formData.get('avatar') as File | null;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Avatar must be under 2MB' };
    }
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Avatar must be an image' };
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExt)) {
      return { success: false, error: 'Invalid file extension. Only PNG, JPG, JPEG, GIF, or WEBP images are allowed.' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // MED-07: Magic bytes verification for PNG, JPEG, GIF, WEBP (RIFF)
    const hex = buffer.toString('hex', 0, 4).toUpperCase();
    const isValidImage =
      hex === '89504E47' ||       // PNG
      hex.startsWith('FFD8FF') || // JPEG (first 3 bytes, hex will be FFD8FFE0 etc)
      hex === '47494638' ||       // GIF (GIF87a / GIF89a)
      hex === '52494646';         // WEBP (RIFF)

    if (!isValidImage) {
      return { success: false, error: 'Invalid image file content. File does not match allowed image formats.' };
    }

    const fileName = `${session.id}-${Date.now()}.${fileExt}`;

    // Upload to avatars bucket
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return { success: false, error: 'Failed to upload avatar' };
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('avatars')
      .getPublicUrl(uploadData.path);

    // Update employee record
    const { error: dbError } = await supabaseAdmin
      .from('employees')
      .update({ avatar_url: publicUrl })
      .eq('id', session.id);

    if (dbError) {
      console.error('Avatar DB update error:', dbError);
      return { success: false, error: 'Failed to save avatar URL' };
    }

    revalidatePath('/employee/profile');
    revalidatePath('/employee/dashboard');

    await logAuditAction(
      'UPDATE_AVATAR',
      'employees',
      session.id,
      null,
      { avatar_url: publicUrl }
    );

    return { success: true, avatarUrl: publicUrl };
  } catch (err: any) {
    console.error('updateAvatar crashed:', err);
    return { success: false, error: err.message || 'Failed to upload avatar' };
  }
}

export async function updateNotificationPreferences(preferences: {
  leave_approved: boolean;
  leave_rejected: boolean;
  attendance_reminder: boolean;
  daily_report_reminder: boolean;
  holiday_reminder: boolean;
  company_announcement: boolean;
}) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return { success: false, error: 'Unauthorized' };
    }
    await verifyActiveSession(session.id);

    const { data, error } = await supabaseAdmin
      .from('employees')
      .update({ notification_preferences: preferences })
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: 'Failed to update preferences' };
    }

    revalidatePath('/employee/profile');
    revalidatePath('/employee/dashboard');

    await logAuditAction(
      'UPDATE_NOTIFICATION_PREFERENCES',
      'employees',
      session.id,
      null,
      preferences
    );

    return { success: true, preferences: data.notification_preferences };
  } catch (err: any) {
    console.error('updateNotificationPreferences crashed:', err);
    return { success: false, error: err.message || 'Failed to update preferences' };
  }
}

