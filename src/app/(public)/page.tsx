import type { Metadata } from 'next';
import Hero from '@/components/sections/Hero';
import Stats from '@/components/sections/Stats';
import ServicesOverview from '@/components/sections/ServicesOverview';
import Testimonials from '@/components/sections/Testimonials';
import CTASection from '@/components/sections/CTASection';
import FAQSection from '@/components/sections/FAQSection';
import { faqs } from '@/lib/faq-data';
import SchemaMarkup from '@/components/layout/SchemaMarkup';

export const metadata: Metadata = {
  title: 'Primetek Global Solutions | IT Staffing & Consulting | Birmingham, AL',
  description: 'Primetek Global Solutions is a US-based IT staffing and consulting firm offering Contract, C2C, Contract-to-Hire, and Full-Time recruitment across IT, Healthcare, Finance, and Manufacturing.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com',
  },
  keywords: [
    'IT Staffing Birmingham Alabama',
    'C2C Staffing Company USA',
    'Contract IT Staffing',
    'IT Recruiting Firm',
    'Primetek Global Solutions',
    'US IT Staffing Agency',
    'Contract-to-Hire IT',
    'Full-Time IT Recruitment',
  ],
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
    "image": "https://www.primetekglobalsolutions.com/opengraph-image.png",
    "telephone": "+1-219-345-6559",
    "email": "hr@primetekglobalsolutions.com",
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
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "18:00"
    },
    "sameAs": [
      "https://www.linkedin.com/company/primetek-global-solutions"
    ],
    "priceRange": "$$",
    "areaServed": {
      "@type": "Country",
      "name": "United States"
    },
    "knowsAbout": [
      "IT Staffing",
      "C2C Placements",
      "Contract Staffing",
      "Full-Time Recruitment",
      "Healthcare Staffing",
      "Finance Staffing"
    ]
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };

  return (
    <>
      <SchemaMarkup schema={websiteSchema} />
      <SchemaMarkup schema={businessSchema} />
      <SchemaMarkup schema={faqSchema} />
      <Hero />
      <Stats />
      <ServicesOverview />
      <Testimonials />
      <FAQSection />
      <CTASection />
    </>
  );
}
