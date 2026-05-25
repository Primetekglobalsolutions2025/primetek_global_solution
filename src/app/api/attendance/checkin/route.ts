import { NextResponse } from 'next/server';
import { checkIn } from '@/app/employee/attendance/actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { latitude, longitude, ipAddress, userAgent, deviceFingerprint } = body;
    
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
