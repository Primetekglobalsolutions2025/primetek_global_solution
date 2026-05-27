import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.primetekglobalsolutions.com';
  
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/services', '/industries', '/contact'],
      disallow: ['/admin/', '/employee/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
