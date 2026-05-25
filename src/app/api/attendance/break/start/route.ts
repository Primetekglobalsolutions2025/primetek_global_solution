import { NextResponse } from 'next/server';
import { startBreak } from '@/app/employee/attendance/actions';

export async function POST(req: Request) {
  try {
    const result = await startBreak();
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in break start api:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
