/**
 * Office Network Trust Verification
 * 
 * Checks whether an incoming request originates from a trusted office network.
 * Uses environment-configured IP addresses/CIDR ranges.
 * 
 * This is a TRUST SIGNAL, not proof of presence.
 * Remote/WFH employees are NOT blocked — they simply receive a higher risk score.
 */

// ── Configuration ────────────────────────────────────────────
import { supabaseAdmin } from '../supabase-admin';


/**
 * Parse trusted office IPs from environment variable.
 * Format: comma-separated IPs or CIDR ranges.
 * Example: OFFICE_TRUSTED_IPS=203.0.113.50,198.51.100.0/24
 */
function getOfficeTrustedIPs(): string[] {
  const raw = process.env.OFFICE_TRUSTED_IPS || '';
  if (!raw.trim()) return [];
  return raw.split(',').map(ip => ip.trim()).filter(Boolean);
}

/**
 * Check if an IP matches a CIDR range.
 * Supports both exact IPs and /24, /16 notation.
 */
function ipMatchesCIDR(ip: string, cidr: string): boolean {
  // Exact match
  if (!cidr.includes('/')) {
    return ip === cidr;
  }

  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits)) return false;

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  if (ipNum === null || rangeNum === null) return false;

  const mask = ~(2 ** (32 - bits) - 1) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Check if the given IP address belongs to a trusted office network.
 */
export async function isOfficeNetwork(ipAddress: string): Promise<boolean> {
  let trustedIPs: string[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('portal_config')
      .select('config_value')
      .eq('config_key', 'office_ip_whitelist')
      .maybeSingle();

    if (!error && data?.config_value) {
      trustedIPs = data.config_value.split(',').map((ip: string) => ip.trim()).filter(Boolean);
    }
  } catch (err) {
    console.error('Error fetching office IP whitelist from DB:', err);
  }

  // Fallback to environment variable if DB configuration is empty
  if (trustedIPs.length === 0) {
    trustedIPs = getOfficeTrustedIPs();
  }

  // If no office IPs are configured, treat all as untrusted (safe default)
  if (trustedIPs.length === 0) return false;

  // Normalize IPv6-mapped IPv4 (::ffff:1.2.3.4 → 1.2.3.4)
  const normalizedIp = ipAddress.startsWith('::ffff:')
    ? ipAddress.slice(7)
    : ipAddress;

  return trustedIPs.some(trusted => ipMatchesCIDR(normalizedIp, trusted));
}

/**
 * Extract the client IP from request headers.
 * Works behind Vercel, Cloudflare, and nginx reverse proxies.
 */
export function extractClientIP(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || '127.0.0.1';
}

/**
 * Check if office IPs are configured in the environment.
 */
export function isOfficeNetworkConfigured(): boolean {
  return getOfficeTrustedIPs().length > 0;
}
