import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const location = searchParams.get('location');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    if (location && location !== 'all') {
      query = query.eq('location', location);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (search && search.trim().length > 0 && search.length <= 100) {
      const cleanSearch = search.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`title.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%,department.ilike.%${cleanSearch}%`);
      }
    }


    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data, total: data?.length || 0 });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
