import { NextResponse } from 'next/server';
import { endBreak } from '@/app/employee/attendance/actions';

export async function POST(req: Request) {
  try {
    const result = await endBreak();
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in break end api:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
