import { NextResponse } from 'next/server';

export async function GET() {
  // Test if env.ts validation works (this is what the login route uses)
  let envValidationResult = 'unknown';
  try {
    const { env } = await import('@/lib/env');
    void env.NEXT_PUBLIC_SUPABASE_URL; // triggers lazy validation
    envValidationResult = 'PASS';
  } catch (e: any) {
    envValidationResult = `FAIL: ${e.message}`;
  }

  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
    supabaseUrlLength: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').length,
    anonKeyLength: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length,
    serviceKeyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    jwtSecretSet: !!process.env.JWT_SECRET,
    jwtSecretLength: (process.env.JWT_SECRET || '').length,
    adminEmail: process.env.ADMIN_EMAIL || 'not set',
    nodeEnv: process.env.NODE_ENV || 'not set',
    envValidation: envValidationResult,
  });
}
