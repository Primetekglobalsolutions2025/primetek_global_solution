import type { Metadata } from 'next';
import { Monitor, HeartPulse, Landmark, Factory, ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import Card from '@/components/ui/Card';
import CTASection from '@/components/sections/CTASection';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Industries We Serve',
  description:
    'Primetek Global Solutions delivers staffing and consulting across IT, Healthcare, Finance, Manufacturing, and Retail.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/industries',
  },
};

const industries = [
  {
    icon: <Monitor className="w-8 h-8" />,
    title: 'Information Technology',
    description: 'Full-stack developers, cloud architects, cybersecurity specialists, and data engineers for the digital economy.',
    areas: ['Software Development', 'Cloud & DevOps', 'Cybersecurity', 'Data Science & AI', 'QA & Testing'],
    gradient: 'from-blue-500 to-blue-700',
  },
  {
    icon: <HeartPulse className="w-8 h-8" />,
    title: 'Healthcare',
    description: 'Clinical and non-clinical talent for hospitals, biotech firms, pharma companies, and health-tech startups.',
    areas: ['Clinical Research', 'Health IT', 'Medical Administration', 'Pharma Sales', 'Regulatory Affairs'],
    gradient: 'from-emerald-500 to-emerald-700',
  },
  {
    icon: <Landmark className="w-8 h-8" />,
    title: 'Banking & Finance',
    description: 'Risk analysts, compliance officers, fintech engineers, and investment professionals for the financial sector.',
    areas: ['Risk & Compliance', 'Fintech Development', 'Investment Banking', 'Accounting', 'Insurance'],
    gradient: 'from-amber-500 to-amber-700',
  },
  {
    icon: <Factory className="w-8 h-8" />,
    title: 'Manufacturing',
    description: 'Engineers, supply chain experts, quality assurance, and operations talent for manufacturing excellence.',
    areas: ['Supply Chain', 'Quality Assurance', 'Production Engineering', 'EHS & Safety', 'Procurement'],
    gradient: 'from-slate-500 to-slate-700',
  },
  {
    icon: <ShoppingBag className="w-8 h-8" />,
    title: 'Retail & E-Commerce',
    description: 'Digital marketers, UX designers, logistics managers, and customer experience professionals for modern retail.',
    areas: ['E-Commerce Operations', 'Digital Marketing', 'UX/UI Design', 'Logistics', 'Merchandising'],
    gradient: 'from-purple-500 to-purple-700',
  },
];

export default function IndustriesPage() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Industries', path: '/industries' }
  ];

  return (
    <>
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="container-wide text-center">
          <span className="inline-block text-primary-300 font-semibold text-sm uppercase tracking-widest mb-3">
            Industries
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 max-w-4xl mx-auto">
            Deep Expertise Across Verticals
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            We understand the unique talent needs of each industry and deliver specialized workforce solutions.
          </p>
        </div>
      </section>

      {/* Industry Cards */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {industries.map((industry) => (
              <Card key={industry.title} className="p-8 flex flex-col h-full">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${industry.gradient} flex items-center justify-center text-white mb-6 shadow-lg`}>
                  {industry.icon}
                </div>
                <h3 className="text-xl font-heading font-bold text-navy-900 mb-3">{industry.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-5 flex-grow">{industry.description}</p>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Key Areas</p>
                  <div className="flex flex-wrap gap-2">
                    {industry.areas.map((area) => (
                      <span
                        key={area}
                        className="px-3 py-1 text-xs rounded-full bg-surface-alt text-text-secondary border border-border"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            {/* Contact card */}
            <Card className="p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
              <h3 className="text-xl font-heading font-bold text-navy-900 mb-3">
                Don&apos;t See Your Industry?
              </h3>
              <p className="text-text-secondary text-sm mb-6">
                We serve 15+ verticals. Let&apos;s discuss your specific talent needs.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-primary-500 font-semibold hover:gap-3 transition-all"
              >
                Talk to Us <ArrowRight className="w-4 h-4" />
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
