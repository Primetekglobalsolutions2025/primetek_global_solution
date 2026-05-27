/**
 * Centralized SEO Utilities and Schema Generators
 * Enforces canonical configurations and builds structured JSON-LD schemas
 */

export const CANONICAL_DOMAIN = 'https://www.primetekglobalsolutions.com';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

/**
 * Generates a standard BreadcrumbList Schema JSON-LD structure
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${CANONICAL_DOMAIN}${item.path.startsWith('/') ? '' : '/'}${item.path}`
    }))
  };
}

/**
 * Generates standard Page Metadata helpers
 */
export function getPageMetadata(title: string, description: string, path: string, keywords: string[] = []) {
  const canonicalUrl = `${CANONICAL_DOMAIN}${path.startsWith('/') ? '' : '/'}${path}`;
  
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
    }
  };
}
