import { NextRequest, NextResponse } from 'next/server';
import { applicationSchema } from '@/lib/validations';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { apiRateLimiter, consumeRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit public submissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as any).ip || 'unknown-ip';
    const rateResult = await consumeRateLimit(apiRateLimiter, ip);
    if (!rateResult.allowed) {
      const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const formData = await request.formData();

    const body = {
      job_id: formData.get('job_id') as string,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || undefined,
      experience_years: formData.get('experience_years')
        ? Number(formData.get('experience_years'))
        : undefined,
      cover_letter: (formData.get('cover_letter') as string) || undefined,
    };

    const validated = applicationSchema.parse(body);

    const resume = formData.get('resume') as File | null;
    let resumeUrl = '';

    if (resume && resume.size > 0) {
      if (resume.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Resume must be under 5MB' }, { status: 400 });
      }

      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!validTypes.includes(resume.type)) {
        return NextResponse.json({ error: 'Only PDF and Word documents are accepted' }, { status: 400 });
      }

      const fileExt = resume.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['pdf', 'doc', 'docx'];
      if (!fileExt || !validExtensions.includes(fileExt)) {
        return NextResponse.json({ error: 'Only PDF and Word documents are accepted' }, { status: 400 });
      }

      const buffer = Buffer.from(await resume.arrayBuffer());

      // Magic bytes verification
      const hex = buffer.toString('hex', 0, 4).toUpperCase();
      let isMagicValid = false;
      // PDF: %PDF (25504446)
      if (hex === '25504446') {
        isMagicValid = true;
      }
      // DOCX/ZIP: PK.. (504B0304)
      else if (hex === '504B0304') {
        isMagicValid = true;
      }
      // DOC: D0CF11E0
      else if (hex === 'D0CF11E0') {
        isMagicValid = true;
      }

      if (!isMagicValid) {
        return NextResponse.json({ error: 'Invalid file content. Only PDF and Word documents are accepted' }, { status: 400 });
      }

      const fileName = `${validated.job_id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('resumes')
        .upload(fileName, buffer, {
          contentType: resume.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Resume upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
      }
      
      resumeUrl = uploadData.path;
    }

    const { error } = await supabaseAdmin.from('applications').insert([
      {
        job_id: validated.job_id,
        name: validated.name,
        email: validated.email,
        phone: validated.phone || null,
        experience_years: validated.experience_years || null,
        cover_letter: validated.cover_letter || null,
        resume_url: resumeUrl || null,
        status: 'pending'
      }
    ]);

    if (error) throw error;

    return NextResponse.json(
      { success: true, message: 'Application submitted successfully' },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.issues }, { status: 400 });
    }
    console.error('Application submission error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
