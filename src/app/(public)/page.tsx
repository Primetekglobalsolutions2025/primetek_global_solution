import type { Metadata } from 'next';
import Hero from '@/components/sections/Hero';
import Stats from '@/components/sections/Stats';
import ServicesOverview from '@/components/sections/ServicesOverview';
import Testimonials from '@/components/sections/Testimonials';
import CTASection from '@/components/sections/CTASection';
import SchemaMarkup from '@/components/layout/SchemaMarkup';

export const metadata: Metadata = {
  title: 'Primetek Global Solutions | Staffing & Consulting',
  description: 'Leading US-based staffing and recruiting firm specializing in IT, Healthcare, Finance, and Manufacturing.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com',
  },
};

export default function HomePage() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Primetek Global Solutions",
    "url": "https://www.primetekglobalsolutions.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.primetekglobalsolutions.com/?s={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const businessSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": "https://www.primetekglobalsolutions.com/#localbusiness",
    "name": "Primetek Global Solutions",
    "url": "https://www.primetekglobalsolutions.com",
    "image": "https://www.primetekglobalsolutions.com/favicon.svg",
    "telephone": "+1-219-345-6559",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "1680, Unit 2G, 14th Ave S",
      "addressLocality": "Birmingham",
      "addressRegion": "AL",
      "postalCode": "35205",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 33.5019,
      "longitude": -86.7972
    },
    "priceRange": "$$"
  };

  return (
    <>
      <SchemaMarkup schema={websiteSchema} />
      <SchemaMarkup schema={businessSchema} />
      <Hero />
      <Stats />
      <ServicesOverview />
      <Testimonials />
      <CTASection />
    </>
  );
}


