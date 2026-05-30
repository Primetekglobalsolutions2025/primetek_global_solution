import type { Metadata } from 'next';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import InquiryForm from '@/components/sections/InquiryForm';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Submit a Staffing Requirement | Primetek Global Solutions',
  description:
    'Submit your IT staffing requirement. We respond within 24 hours with matched candidates for contract, C2C, and full-time roles.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/contact',
  },
};

const contactInfo = [
  { icon: <Mail className="w-5 h-5" />, label: 'Email', value: 'hr@primetekglobalsolutions.com', href: 'mailto:hr@primetekglobalsolutions.com' },
  { icon: <Phone className="w-5 h-5" />, label: 'Phone', value: '+1 (219) 345-6559', href: 'tel:+12193456559' },
  { icon: <MapPin className="w-5 h-5" />, label: 'Office', value: '1680, Unit 2G, 14th Ave S, Birmingham, AL 35205, USA', href: 'https://maps.google.com/?q=1680+Unit+2G+14th+Ave+S+Birmingham+AL+35205' },
  { icon: <Clock className="w-5 h-5" />, label: 'Hours', value: 'Mon - Fri, 9:00 AM - 6:00 PM EST', href: '#' },
];

const nextSteps = [
  {
    step: 'Step 1',
    title: 'We Review Your Requirement (Same Day)',
    desc: 'Our technical sourcing team reviews your requirement to understand technical specifics and timeline.'
  },
  {
    step: 'Step 2',
    title: 'We Identify Matched Candidates (1-2 Days)',
    desc: 'We query our active database and reach out to vetted candidates matching your tech stack.'
  },
  {
    step: 'Step 3',
    title: 'We Send You a Shortlist',
    desc: 'Expect matched candidates in 3-5 business days for contract roles, and 7-10 business days for full-time roles.'
  }
];

export default function ContactPage() {
  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    mainEntity: {
      '@type': 'Organization',
      name: 'Primetek Global Solutions',
      url: 'https://www.primetekglobalsolutions.com',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+1-219-345-6559',
        email: 'hr@primetekglobalsolutions.com',
        contactType: 'HR and Sales Support',
        areaServed: 'US',
        availableLanguage: 'en',
      },
    },
  };

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Contact Us', path: '/contact' },
  ];

  return (
    <>
      <SchemaMarkup schema={contactSchema} />
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />

      {/* Hero (Dark Navy) */}
      <section className="pt-32 pb-20 bg-surface-dark text-white relative">
        <div className="max-w-[1200px] mx-auto px-4 text-center">
          <span className="inline-block text-teal-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Contact Us
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-[-1.5px] leading-tight mb-5 max-w-3xl mx-auto">
            Submit a Staffing Requirement
          </h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Fill out the form below. We respond within 24 hours with a tailored proposal.
          </p>
        </div>
      </section>

      {/* Form + Info (White Canvas) */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* Contact Info (2 Columns desktop equivalent) */}
            <div className="lg:col-span-5">
              <h2 className="text-2xl font-semibold text-ink tracking-tight mb-6">
                Get in Touch
              </h2>
              <p className="text-sm text-body-text leading-relaxed mb-8 max-w-md">
                Submit details on your contract, C2C, or full-time staffing needs. Our Birmingham-based team responds to all inquiries within 24 hours.
              </p>

              <div className="space-y-4">
                {contactInfo.map((item) => {
                  const Comp = item.href === '#' ? 'div' : 'a';
                  return (
                    <Comp
                      key={item.label}
                      href={item.href !== '#' ? item.href : undefined}
                      className="flex items-start gap-4 p-4 rounded-xl border border-hairline hover:bg-surface-card transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0 group-hover:bg-teal-primary group-hover:text-white transition-colors">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-0.5">
                          {item.label}
                        </p>
                        <p className="text-ink font-semibold text-sm leading-tight">{item.value}</p>
                      </div>
                    </Comp>
                  );
                })}
              </div>
            </div>

            {/* Inquiry Form (3 Columns desktop equivalent) */}
            <div className="lg:col-span-7">
              <div className="bg-surface-card rounded-2xl p-6 md:p-8 border border-hairline shadow-sm">
                <h2 className="text-xl font-semibold text-ink tracking-tight mb-2">
                  Send Us an Inquiry
                </h2>
                <p className="text-sm text-body-text mb-6">
                  Fill out the form below to submit your requirements.
                </p>
                <InquiryForm />
              </div>
            </div>

          </div>

          {/* What Happens Next Mini-Flow */}
          <div className="border-t border-hairline pt-20 mt-20 max-w-4xl mx-auto">
            <h3 className="text-xl font-semibold text-ink text-center mb-12">
              What Happens Next
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {nextSteps.map((step) => (
                <div key={step.step} className="bg-surface-card border border-hairline rounded-xl p-6 shadow-sm">
                  <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded bg-teal-primary/5 text-teal-primary mb-4">
                    {step.step}
                  </span>
                  <h4 className="text-sm font-semibold text-ink mb-2">{step.title}</h4>
                  <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
