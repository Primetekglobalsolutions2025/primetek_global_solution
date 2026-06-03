import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('[Job Tracker API] GOOGLE_SHEET_WEBHOOK_URL is not configured in environment variables.');
      return NextResponse.json({ error: 'Google Sheet Webhook URL is not configured.' }, { status: 500 });
    }

    // Call the Google Apps Script Web App
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Next.js specific option to disable caching
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[Job Tracker API] Apps Script query failed with status: ${response.status}`);
      return NextResponse.json({ error: `Apps Script query failed with status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Job Tracker API] Error proxying job applications:', error);
    return NextResponse.json(
      { error: error?.message || 'An internal error occurred while fetching job applications.' },
      { status: 500 }
    );
  }
}
