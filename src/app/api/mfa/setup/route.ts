import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { generateMFASecret, generateQRCode, encryptSecret } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    // Generate secret
    const { secret, otpauth } = generateMFASecret(session.email);
    const qrCode = await generateQRCode(otpauth);

    // Temporarily save encrypted secret in DB (not enabled yet)
    const table = session.role === 'admin' ? 'admin_users' : 'employees';
    const encryptedSecret = encryptSecret(secret);
    const { error } = await supabaseAdmin
      .from(table)
      .update({ mfa_secret: encryptedSecret, mfa_enabled: false })
      .eq('id', session.id);

    if (error) throw error;

    return NextResponse.json({ qrCode });
  } catch (err) {
    console.error('MFA Setup error:', err);
    return NextResponse.json({ error: 'Failed to initiate MFA setup' }, { status: 500 });
  }
}
