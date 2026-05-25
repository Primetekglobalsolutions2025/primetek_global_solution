import { NextResponse } from 'next/server';
import { checkOut } from '@/app/employee/attendance/actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recordId, latitude, longitude, ipAddress, userAgent, deviceFingerprint } = body;
    
    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }
    
    const result = await checkOut(recordId, latitude, longitude, ipAddress, userAgent, deviceFingerprint);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in checkout api:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
