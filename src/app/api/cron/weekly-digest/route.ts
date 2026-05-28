import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: 'Weekly digest cron job is not implemented yet. Weekly digests are saved but not scheduled.' }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
