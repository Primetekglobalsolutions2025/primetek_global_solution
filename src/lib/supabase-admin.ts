import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Admin Supabase client (bypasses RLS).
 * 
 * Lazily initialized to prevent crashes during `next build`
 * when env vars are not yet available. The client is created
 * on first property access.
 */
let _client: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (!_client) {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
      if (isBuildPhase) {
        console.warn('⚠️ Supabase Admin credentials missing during build phase. Returning mock client.');
        return null;
      }
      throw new Error(
        'Cannot create Supabase Admin client: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.'
      );
    }

    _client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

// A chainable recursive proxy that resolves to empty results.
// This prevents crashes during `next build` static page generation.
const createMockClient = (): any => {
  const mock: any = new Proxy(() => {}, {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: any) => resolve({ data: [], error: null });
      }
      return createMockClient();
    },
    apply() {
      return createMockClient();
    }
  });
  return mock;
};

const mockClient = createMockClient();

// Proxy so callers can use `supabaseAdmin.from(...)` without changing syntax
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    const client = getAdminClient();
    if (!client) {
      return mockClient[prop];
    }
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
