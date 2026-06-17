import type { Metadata } from 'next';
import { Monitor, HeartPulse, Landmark, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import CTASection from '@/components/sections/CTASection';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Industries We Serve | IT, Healthcare, Finance | Primetek Global Solutions',
  description:
    'Primetek Global Solutions delivers IT staffing across Information Technology, Healthcare, and Banking & Finance industries in the United States.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/industries',
  },
};

const industries = [
  {
    icon: <Monitor className="w-6 h-6" />,
    title: 'Information Technology',
    desc: 'Full-stack developers, cloud architects, cybersecurity specialists, and data engineers for the digital economy.',
    areas: ['Software Development', 'Cloud & DevOps', 'Cybersecurity', 'Data Science & AI', 'QA & Testing']
  },
  {
    icon: <HeartPulse className="w-6 h-6" />,
    title: 'Healthcare',
    desc: 'Health IT developers, clinical systems analysts, and compliance-driven recruiting for hospitals and healthcare systems.',
    areas: ['Health IT', 'Clinical Systems', 'Medical Records', 'Healthcare Compliance']
  },
  {
    icon: <Landmark className="w-6 h-6" />,
    title: 'Banking & Finance',
    desc: 'Fintech developers, risk analysts, compliance specialists, and quantitative engineers for financial institutions.',
    areas: ['Fintech Dev', 'Risk & Compliance', 'Quantitative Analysis', 'Financial Systems']
  }
];

export default function IndustriesPage() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Industries', path: '/industries' },
  ];

  const industriesListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Industries Served by Primetek Global Solutions',
    numberOfItems: industries.length,
    itemListElement: industries.map((industry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: industry.title,
      description: industry.desc,
    })),
  };

  return (
    <>
      <SchemaMarkup schema={industriesListSchema} />
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />

      {/* Hero (Dark Navy) */}
      <section className="pt-32 pb-20 bg-surface-dark text-white relative">
        <div className="max-w-[1200px] mx-auto px-4 text-center">
          <span className="inline-block text-teal-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Industries
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-[-1.5px] leading-tight mb-5 max-w-3xl mx-auto">
            Industries We Serve
          </h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            We have active placements in these industries. We only list what we&apos;ve earned.
          </p>
        </div>
      </section>

      {/* Industries (White Canvas) */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {industries.map((ind) => (
              <div key={ind.title} className="bg-surface-card rounded-xl border border-hairline p-8 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-lg bg-teal-primary/5 text-teal-primary flex items-center justify-center mb-6">
                    {ind.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-ink mb-3">{ind.title}</h3>
                  <p className="text-sm text-body-text leading-relaxed mb-6">{ind.desc}</p>
                </div>

                <div className="border-t border-hairline pt-4 mt-auto">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Key Areas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ind.areas.map((area) => (
                      <span
                        key={area}
                        className="px-2.5 py-1 text-xs font-medium rounded-full bg-white text-body-text border border-hairline"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Expanding note card */}
          <div className="bg-white border-l-4 border-l-teal-primary border border-hairline rounded-r-xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-4xl mx-auto">
            <div>
              <h4 className="text-base font-semibold text-ink mb-1">We&apos;re actively expanding</h4>
              <p className="text-sm text-body-text leading-relaxed">
                If your industry is not listed above, contact us anyway — we may still be able to help.
              </p>
            </div>
            <Link href="/contact" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-primary hover:text-teal-active shrink-0">
              Contact Us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
