import type { Metadata } from 'next';
import { Target, Eye, XCircle } from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'About Us | US-Based IT Staffing Firm | Primetek Global Solutions',
  description:
    'Learn about Primetek Global Solutions — a Birmingham, Alabama IT staffing firm founded in 2024, focused on placing IT professionals with US-based clients.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/about',
  },
};

const approachItems = [
  {
    title: 'IT Only',
    desc: 'We specialize in IT staffing exclusively. No generalist recruiting.'
  },
  {
    title: 'US Market Only',
    desc: 'We serve US-based clients only, with deep understanding of US hiring.'
  },
  {
    title: 'Speed',
    desc: 'Contract roles in 3-5 days. Full-time in 7-10 days.'
  }
];

const blockers = [
  "We don't pad candidate lists with unqualified profiles",
  "We don't work with clients outside the US market",
  "We don't offer non-IT staffing or general consulting"
];

export default function AboutPage() {
  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    mainEntity: {
      '@type': 'Organization',
      name: 'Primetek Global Solutions',
      url: 'https://www.primetekglobalsolutions.com',
      description:
        'Primetek Global Solutions LLC is a US-based IT staffing and recruiting company founded in 2024, headquartered in Birmingham, Alabama.',
      foundingDate: '2024',
      knowsAbout: [
        'IT Staffing',
        'C2C Placements',
        'Software Development Recruitment',
        'DevOps Staffing',
        'Data Science Recruitment',
      ],
    },
  };

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'About Us', path: '/about' },
  ];

  return (
    <>
      <SchemaMarkup schema={aboutSchema} />
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />

      {/* Hero (Dark Navy) */}
      <section className="pt-32 pb-20 bg-surface-dark text-white relative">
        <div className="max-w-[1200px] mx-auto px-4 text-center">
          <span className="inline-block text-teal-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Company Overview
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-[-1.5px] leading-tight mb-5 max-w-3xl mx-auto">
            About Primetek Global Solutions
          </h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            A US-based IT staffing firm founded in 2024, focused on connecting skilled IT professionals with US companies across contract, C2C, and full-time roles.
          </p>
        </div>
      </section>

      {/* Who We Are (White Canvas) */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7">
              <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
                WHO WE ARE
              </span>
              <h2 className="text-2xl md:text-4xl font-semibold text-ink tracking-[-1px] leading-[1.1] mb-6">
                End-to-End IT Talent Solutions
              </h2>
              <div className="space-y-4 text-body-text text-sm leading-relaxed max-w-xl">
                <p>
                  Primetek Global Solutions LLC provides focused IT recruitment, placing skilled software engineers, DevOps architects, data scientists, and specialized tech professionals.
                </p>
                <p>
                  We operate with a direct, streamlined process tailored entirely to the domestic US market. By avoiding administrative bloat, we match technical roles and deliver candidate shortlists within days.
                </p>
                <p>
                  Whether you are a startup needing specialized skills, a mid-market enterprise growing your team, or a tech group managing project spikes, we offer contract, C2C, contract-to-hire, and full-time staffing structures to fit your requirements.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-surface-card rounded-xl border border-hairline p-8 shadow-sm">
                <h3 className="text-lg font-semibold text-ink mb-6 border-b border-hairline pb-4">
                  Company At a Glance
                </h3>
                <ul className="space-y-4 list-none p-0 m-0 text-sm">
                  <li className="flex justify-between">
                    <span className="text-muted font-medium">Founded</span>
                    <span className="text-ink font-semibold">2024</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted font-medium">Headquarters</span>
                    <span className="text-ink font-semibold">Birmingham, AL</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted font-medium">Industry</span>
                    <span className="text-ink font-semibold">IT Staffing & Recruiting</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted font-medium">Market</span>
                    <span className="text-ink font-semibold">United States Only</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Our Approach (Surface Card #f5f5f5) */}
      <section className="py-24 bg-surface-card border-y border-hairline">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
              OUR APPROACH
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1]">
              How We Work
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {approachItems.map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-hairline p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-ink mb-3">{item.title}</h3>
                <p className="text-sm text-body-text leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision (White Canvas) */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="bg-white border-l-4 border-l-teal-primary border border-hairline rounded-r-xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-5 h-5 text-teal-primary" />
                <h3 className="text-xl font-semibold text-ink">Our Mission</h3>
              </div>
              <p className="text-sm text-body-text leading-relaxed">
                To connect US companies with skilled IT professionals through fast, reliable, and transparent staffing.
              </p>
            </div>

            <div className="bg-white border-l-4 border-l-teal-primary border border-hairline rounded-r-xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-5 h-5 text-teal-primary" />
                <h3 className="text-xl font-semibold text-ink">Our Vision</h3>
              </div>
              <p className="text-sm text-body-text leading-relaxed">
                To be the go-to IT staffing partner for US companies that need quality talent without enterprise agency overhead.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* What We Don't Do (Surface Card #f5f5f5) */}
      <section className="py-24 bg-surface-card border-y border-hairline">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
              OUR BOUNDARIES
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1] mb-4">
              What We Don&apos;t Do
            </h2>
            <p className="text-base text-body-text leading-relaxed">
              We believe in being direct about our scope.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blockers.map((blocker, i) => (
              <div key={i} className="bg-white rounded-xl border border-hairline p-6 flex gap-4 items-start shadow-sm">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-body-text font-medium leading-relaxed">{blocker}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
