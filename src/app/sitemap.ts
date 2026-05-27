import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.primetekglobalsolutions.com';
  
  const routes = ['', '/about', '/services', '/industries', '/contact'];
  
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route === '/contact' ? 0.8 : 0.7,
  }));
}
