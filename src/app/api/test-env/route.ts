import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
    supabaseUrlLength: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').length,
    anonKeyLength: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length,
    serviceKeyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    adminEmail: process.env.ADMIN_EMAIL || 'not set',
  });
}
