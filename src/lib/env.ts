import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_GEOAPIFY_API_KEY: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional().or(z.literal("").transform(() => undefined)),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET environment variable is required'),
  MFA_ENCRYPTION_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional().or(z.literal("").transform(() => undefined)),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  GOOGLE_SHEET_WEBHOOK_URL: z.string().min(1).optional(),
}).superRefine((data, ctx) => {
  if (process.env.NODE_ENV === 'production') {
    if (!data.JWT_SECRET || data.JWT_SECRET === 'primetek-fallback-secret-key-2026') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'In production, JWT_SECRET must be explicitly set and cannot be the default fallback key.',
        path: ['JWT_SECRET'],
      });
    } else if (data.JWT_SECRET.length < 32) {
      console.warn('⚠️ Warning: In production, JWT_SECRET is recommended to be at least 32 characters long.');
    }

    if (!data.SUPABASE_SERVICE_ROLE_KEY || data.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-key') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'In production, SUPABASE_SERVICE_ROLE_KEY must be explicitly set.',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
      });
    }

    if (!data.MFA_ENCRYPTION_SECRET) {
      console.warn('⚠️ Warning: MFA_ENCRYPTION_SECRET is not set in production. Falling back to JWT_SECRET for MFA encryption.');
    } else if (data.MFA_ENCRYPTION_SECRET === data.JWT_SECRET) {
      console.warn('⚠️ Warning: In production, MFA_ENCRYPTION_SECRET is recommended to be different from JWT_SECRET.');
    }

    if (!data.CRON_SECRET) {
      console.warn('⚠️ Warning: CRON_SECRET is not set in production. Cron endpoints will not verify authorization via bearer token.');
    }
  }
});

// Detect if we are on the server or client
const isServer = typeof window === 'undefined';

/**
 * Lazy-validated environment variables.
 * Uses a Proxy so validation only runs the first time a property is accessed
 * at runtime (not during module evaluation / build time).
 */
function createLazyEnv() {
  let cached: z.infer<typeof serverSchema> | null = null;

  return new Proxy({} as z.infer<typeof serverSchema>, {
    get(_target, prop: string) {
      if (!cached) {
        const rawEnv: Record<string, string | undefined> = {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          NEXT_PUBLIC_GEOAPIFY_API_KEY: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          RESEND_API_KEY: process.env.RESEND_API_KEY,
          JWT_SECRET: process.env.JWT_SECRET,
          MFA_ENCRYPTION_SECRET: process.env.MFA_ENCRYPTION_SECRET,
          CRON_SECRET: process.env.CRON_SECRET,
          VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
          VAPID_SUBJECT: process.env.VAPID_SUBJECT,
          GOOGLE_SHEET_WEBHOOK_URL: process.env.GOOGLE_SHEET_WEBHOOK_URL,
        };

        // During `next build` page-data collection, env vars may not be
        // available. Return raw values without crashing the build.
        const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

        try {
          cached = isServer
            ? serverSchema.parse(rawEnv)
            : publicSchema.parse({
                NEXT_PUBLIC_SUPABASE_URL: rawEnv.NEXT_PUBLIC_SUPABASE_URL,
                NEXT_PUBLIC_SUPABASE_ANON_KEY: rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                NEXT_PUBLIC_GEOAPIFY_API_KEY: rawEnv.NEXT_PUBLIC_GEOAPIFY_API_KEY,
              }) as unknown as z.infer<typeof serverSchema>;
        } catch (err) {
          if (isBuildPhase) {
            // Provide placeholder values so build doesn't crash
            cached = rawEnv as unknown as z.infer<typeof serverSchema>;
            return (cached as unknown as Record<string, unknown>)[prop] ?? '';
          }
          if (err instanceof z.ZodError) {
            const missing = err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`❌ Environment validation failed: ${missing}`);
          }
          throw err;
        }
      }
      return cached[prop as keyof z.infer<typeof serverSchema>];
    },
  });
}

export const env = createLazyEnv();

/**
 * Validates that all required environment variables are present.
 * Should be called at the top of the main entry points.
 */
export function validateEnv() {
  try {
    // Access a property to trigger lazy validation
    void env.NEXT_PUBLIC_SUPABASE_URL;
    console.log('✅ Environment variables validated');
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
      throw err;
    }
    throw err;
  }
}
