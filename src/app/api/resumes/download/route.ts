import { NextRequest, NextResponse } from 'next/server';
import { getSession, verifyActiveSession, verifyActiveAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user's session is still active
    if (session.role === 'admin') {
      await verifyActiveAdmin(session.id);
    } else {
      await verifyActiveSession(session.id);
    }

    const path = request.nextUrl.searchParams.get('path');
    if (!path || typeof path !== 'string' || path.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid path parameter' }, { status: 400 });
    }

    // Prevent path traversal attacks
    if (path.includes('..') || path.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Generate a short-lived (1 hour) signed URL
    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('resumes')
      .createSignedUrl(path, 3600); // 1 hour expiration

    if (signedError || !signedData?.signedUrl) {
      console.error('[Resume Download] Signed URL generation failed:', signedError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    return NextResponse.redirect(signedData.signedUrl, 307);
  } catch (err) {
    console.error('[Resume Download] Error:', err);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
