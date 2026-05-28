import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from '../supabase-admin';

export const getCachedPortalConfig = unstable_cache(
  async () => {
    const { data, error } = await supabaseAdmin
      .from('portal_config')
      .select('config_key, config_value');

    if (error) {
      console.warn('[getCachedPortalConfig] DB Error fetching portal config:', error);
      return [];
    }

    return data || [];
  },
  ['portal-config-data'],
  {
    revalidate: 300, // 5 minutes TTL
    tags: ['portal-config']
  }
);
