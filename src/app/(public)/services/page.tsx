import type { Metadata } from 'next';
import { Briefcase, Building2, UserCheck, Users } from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'IT Staffing Services | Contract, C2C, Full-Time | Primetek Global Solutions',
  description:
    'Contract Staffing, C2C, Contract-to-Hire, and Full-Time IT recruitment for US-based companies. Covering Software Dev, Cloud/DevOps, Data Science, Cybersecurity, QA, and ERP.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/services',
  },
};

const staffingModels = [
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Contract Staffing',
    desc: 'Short-to-mid term IT professionals for project-based work. Typical duration: 3-12 months. Ideal for seasonal demand or specialized timelines.'
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    title: 'C2C Placements',
    desc: 'Independent contractors operating through their own corporate entity. Offers highly specialized expertise with straightforward corporate invoicing.'
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: 'Contract-to-Hire',
    desc: 'Evaluate candidates on the job before committing to permanent placements. Reduces hiring risk and ensures technical and cultural fit.'
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Full-Time Recruitment',
    desc: 'End-to-end permanent IT hiring. We handle sourcing, screening, and shortlisting. You hire directly onto your company payroll.'
  }
];

const domains = [
  'Software Development',
  'Data Science & AI/ML',
  'Cloud & DevOps',
  'Cybersecurity',
  'QA & Test Automation',
  'ERP Technologies',
  'Business Analysis',
  'Project Management'
];

const tableRoles = [
  { domain: 'Software Dev', roles: 'Java Dev, .NET Dev, Full-Stack Developer' },
  { domain: 'Cloud/DevOps', roles: 'AWS Architect, DevOps Engineer, Site Reliability Engineer' },
  { domain: 'Data Science', roles: 'ML Engineer, Data Analyst, BI Developer' },
  { domain: 'Cybersecurity', roles: 'Security Analyst, Pen Tester, Security Architect' },
  { domain: 'QA', roles: 'SDET, QA Automation Engineer, Manual QA Specialist' },
  { domain: 'ERP', roles: 'SAP Consultant, Workday Admin, Salesforce Developer' }
];

const steps = [
  {
    num: '01',
    title: 'Submit Your Requirement',
    desc: 'Tell us the role, tech stack, location, and timeline via our contact form.'
  },
  {
    num: '02',
    title: 'We Source and Screen',
    desc: 'We identify and pre-screen candidates from our network. Contract roles: 3-5 days. Full-time: 7-10 days.'
  },
  {
    num: '03',
    title: 'You Interview and Hire',
    desc: 'Review shortlisted profiles, conduct interviews, and make the hire. We handle the paperwork.'
  }
];

export default function ServicesPage() {
  const servicesSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: 'IT Staffing & Talent Solutions',
        provider: {
          '@type': 'Organization',
          name: 'Primetek Global Solutions',
          url: 'https://www.primetekglobalsolutions.com',
        },
        description:
          'Short-to-mid term IT professionals for project-based needs, direct C2C placement, contract-to-hire, and full-time permanent recruitment in the US.',
        areaServed: 'US',
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Staffing Services',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Contract Staffing',
                description: 'Short-to-mid term IT professionals for project-based needs.',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'C2C (Contractor-to-Client)',
                description: 'Direct placement of independent contractors for specialized roles.',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Contract-to-Hire',
                description: 'Evaluate candidates on the job before committing to permanent placements.',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Full-Time Recruitment',
                description: 'End-to-end permanent IT hiring for US-based roles.',
              },
            },
          ],
        },
      },
    ],
  };

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
  ];

  return (
    <>
      <SchemaMarkup schema={servicesSchema} />
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />

      {/* Hero (Dark Navy) */}
      <section className="pt-32 pb-20 bg-surface-dark text-white relative">
        <div className="max-w-[1200px] mx-auto px-4 text-center">
          <span className="inline-block text-teal-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Services
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-[-1.5px] leading-tight mb-5 max-w-3xl mx-auto">
            IT Staffing Services
          </h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Contract, C2C, Contract-to-Hire, and Full-Time placement for US-based IT roles.
          </p>
        </div>
      </section>

      {/* Staffing Models (White Canvas) */}
      <section className="py-24 bg-white" id="staffing">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
              MODELS
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1]">
              Staffing Models
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {staffingModels.map((model) => (
              <div key={model.title} className="bg-surface-card rounded-[12px] p-8 border border-hairline flex flex-col justify-between h-full group hover:border-teal-primary/30 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-lg bg-teal-primary/5 text-teal-primary flex items-center justify-center mb-6">
                    {model.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-ink mb-3">{model.title}</h3>
                  <p className="text-sm text-body-text leading-relaxed">{model.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Domains (Surface Card #f5f5f5) */}
      <section className="py-24 bg-surface-card border-y border-hairline" id="domains">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
              EXPERTISE
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1] mb-4">
              Technology Domains
            </h2>
          </div>

          {/* Tags Cloud */}
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto mb-16">
            {domains.map((domain) => (
              <span
                key={domain}
                className="px-5 py-2.5 rounded-full bg-teal-primary text-white text-sm font-semibold shadow-sm"
              >
                {domain}
              </span>
            ))}
          </div>

          {/* Structured Roles Table */}
          <div className="max-w-3xl mx-auto bg-white border border-hairline rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-card border-b border-hairline">
                  <th className="px-6 py-4 text-sm font-semibold text-ink">Domain</th>
                  <th className="px-6 py-4 text-sm font-semibold text-ink">Typical Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {tableRoles.map((row) => (
                  <tr key={row.domain} className="hover:bg-surface-card/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-ink">{row.domain}</td>
                    <td className="px-6 py-4 text-sm text-body-text">{row.roles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How We Work (White Canvas) */}
      <section className="py-24 bg-white" id="process">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
              WORKFLOW
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1]">
              How We Work
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <div className="hidden md:block absolute top-[52px] left-[10%] right-[10%] h-[2px] bg-hairline z-0" />
            {steps.map((step) => (
              <div key={step.num} className="relative z-10 flex flex-col h-full bg-surface-card rounded-xl border border-hairline p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-4xl font-semibold text-teal-primary tracking-tight z-10 bg-surface-card pr-2">
                    {step.num}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-primary shrink-0 z-10" />
                </div>
                <h3 className="text-lg font-semibold text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-body-text leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
