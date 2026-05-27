import type { Metadata } from 'next';
import { Users, Code, Cloud, Shield, Database, LayoutDashboard, Settings, UserCheck, Briefcase, FileText } from 'lucide-react';
import Card from '@/components/ui/Card';
import CTASection from '@/components/sections/CTASection';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Our Services',
  description:
    'Explore Primetek Global Solutions\' comprehensive services — IT Staffing, Contract, C2C, and Full-Time Recruitment.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/services',
  },
};

const serviceCategories = [
  {
    id: 'staffing',
    icon: <Users className="w-8 h-8" />,
    title: 'Our IT Staffing & Talent Solutions',
    gradient: 'from-primary-500 to-primary-700',
    description: 'We connect top IT talent with leading organizations across the US market.',
    subservices: [
      { icon: <Briefcase className="w-5 h-5" />, title: 'Contract Staffing', description: 'Short-to-mid term IT professionals for project-based needs.' },
      { icon: <FileText className="w-5 h-5" />, title: 'C2C (Contractor-to-Client)', description: 'Direct placement of independent contractors for specialized roles.' },
      { icon: <Settings className="w-5 h-5" />, title: 'Contract-to-Hire', description: 'Try-before-you-buy model to evaluate candidates before permanent hire.' },
      { icon: <UserCheck className="w-5 h-5" />, title: 'Full-Time Recruitment', description: 'End-to-end permanent IT hiring for US-based roles.' },
      { icon: <Users className="w-5 h-5" />, title: 'Talent Pipeline Building', description: 'Proactive sourcing and pre-screening for recurring hiring needs.' },
      { icon: <Database className="w-5 h-5" />, title: 'Bench-Ready Talent', description: 'Ready-to-start IT professionals for US clients.' },
    ],
  },
  {
    id: 'domains',
    icon: <Code className="w-8 h-8" />,
    title: 'Technology Domains We Cover',
    gradient: 'from-gold-500 to-gold-600',
    description: 'Expertise across the modern technology stack.',
    subservices: [
      { icon: <Code className="w-5 h-5" />, title: 'Software Development & Architecture', description: 'Java, .NET, Python, JavaScript, and Full-Stack Engineering.' },
      { icon: <Database className="w-5 h-5" />, title: 'Data Science & AI/ML', description: 'Advanced analytics, machine learning, and data engineering.' },
      { icon: <Cloud className="w-5 h-5" />, title: 'Cloud & DevOps', description: 'AWS, Azure, GCP, Docker, Kubernetes, and CI/CD pipelines.' },
      { icon: <Shield className="w-5 h-5" />, title: 'Cybersecurity', description: 'Information security, risk assessment, and compliance.' },
      { icon: <Settings className="w-5 h-5" />, title: 'QA & Test Automation', description: 'SDETs, manual testing, and automated frameworks.' },
      { icon: <LayoutDashboard className="w-5 h-5" />, title: 'ERP Technologies', description: 'SAP, Oracle, Workday, integrations & support.' },
      { icon: <Briefcase className="w-5 h-5" />, title: 'Business Analysis', description: 'Project/Program Management and Product Ownership.' },
    ],
  }
];

export default function ServicesPage() {
  const servicesSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "name": "IT Staffing & Talent Solutions",
        "provider": {
          "@type": "Organization",
          "name": "Primetek Global Solutions",
          "url": "https://www.primetekglobalsolutions.com"
        },
        "description": "Short-to-mid term IT professionals for project-based needs, direct C2C placement, contract-to-hire, and full-time permanent recruitment in the US.",
        "areaServed": "US",
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Staffing Services",
          "itemListElement": [
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "Contract Staffing",
                "description": "Short-to-mid term IT professionals for project-based needs."
              }
            },
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "C2C (Contractor-to-Client)",
                "description": "Direct placement of independent contractors for specialized roles."
              }
            },
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "Contract-to-Hire",
                "description": "Evaluate candidates on the job before committing to permanent placements."
              }
            },
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "Full-Time Recruitment",
                "description": "End-to-end permanent IT hiring for US-based roles."
              }
            }
          ]
        }
      },
      {
        "@type": "Service",
        "name": "Technology Domain Services",
        "provider": {
          "@type": "Organization",
          "name": "Primetek Global Solutions",
          "url": "https://www.primetekglobalsolutions.com"
        },
        "description": "Talent placement and consulting across software development, data science, AI/ML, cloud, DevOps, cybersecurity, QA automation, and ERP systems.",
        "areaServed": "US"
      }
    ]
  };

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' }
  ];

  return (
    <>
      <SchemaMarkup schema={servicesSchema} />
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="container-wide text-center">
          <span className="inline-block text-primary-300 font-semibold text-sm uppercase tracking-widest mb-3">
            Our Services
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 max-w-4xl mx-auto">
            IT Staffing & Talent Solutions
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Empowering businesses with scalable, high-quality IT talent solutions that drive innovation and growth.
          </p>
        </div>
      </section>

      {/* Service Categories */}
      {serviceCategories.map((category, catIndex) => (
        <section
          key={category.id}
          id={category.id}
          className={`section-padding ${catIndex % 2 === 0 ? 'bg-white' : 'bg-surface-alt'}`}
        >
          <div className="container-wide">
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center text-white shadow-lg`}>
                {category.icon}
              </div>
              <div>
                <h2 className="text-3xl font-heading font-bold text-navy-900">{category.title}</h2>
                <p className="text-text-secondary mt-1">{category.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {category.subservices.map((sub) => (
                <Card key={sub.title} className="p-6">
                  <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center mb-4">
                    {sub.icon}
                  </div>
                  <h3 className="font-heading font-bold text-navy-900 mb-2">{sub.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{sub.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      <CTASection />
    </>
  );
}
