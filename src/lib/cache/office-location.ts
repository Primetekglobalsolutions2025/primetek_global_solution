import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from '../supabase-admin';

export const getCachedActiveOfficeLocation = unstable_cache(
  async () => {
    const { data: officeList, error } = await supabaseAdmin
      .from('office_locations')
      .select('name, lat, lng, radius_meters')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[getCachedActiveOfficeLocation] DB Error fetching office location:', error);
      return null;
    }

    return officeList && officeList.length > 0 ? officeList[0] : null;
  },
  ['active-office-location'],
  {
    revalidate: 300, // 5 minutes TTL
    tags: ['office-location']
  }
);
