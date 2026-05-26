import type { NextConfig } from "next";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function generateServiceWorker(buildId: string) {
  try {
    const templatePath = path.join(process.cwd(), 'public', 'sw.template.js');
    const outputPath = path.join(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(templatePath)) {
      let content = fs.readFileSync(templatePath, 'utf8');
      content = content.replace(/%BUILD_ID%/g, buildId);
      fs.writeFileSync(outputPath, content, 'utf8');
      console.log(`[SW] Service worker generated with build ID: ${buildId}`);
    }
  } catch (error) {
    console.error('Failed to generate service worker:', error);
  }
}

// Generate initial service worker at config load time (e.g. dev server startup)
const initialBuildId = process.env.NEXT_PUBLIC_BUILD_ID || crypto.randomUUID();
generateServiceWorker(initialBuildId);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.geoapify.com',
        port: '',
        pathname: '/v1/staticmap/**',
      },
    ],
  },
  generateBuildId: async () => {
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID || crypto.randomUUID();
    generateServiceWorker(buildId);
    return buildId;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://maps.geoapify.com https://grainy-gradients.vercel.app; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.geoapify.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

