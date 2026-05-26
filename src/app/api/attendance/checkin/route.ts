import { NextRequest, NextResponse } from 'next/server';
import { checkIn } from '@/app/employee/attendance/actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { latitude, longitude, deviceFingerprint } = body;
    
    // Extract IP and User-Agent from server-side headers (not client body) to prevent spoofing
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }
    
    const result = await checkIn(latitude, longitude, ipAddress, userAgent, deviceFingerprint);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in checkin api:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
