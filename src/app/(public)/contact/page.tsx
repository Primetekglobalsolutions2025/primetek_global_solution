import type { Metadata } from 'next';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import InquiryForm from '@/components/sections/InquiryForm';
import SchemaMarkup from '@/components/layout/SchemaMarkup';
import { generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Primetek Global Solutions. Submit an inquiry for staffing, consulting, or outsourcing services.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/contact',
  },
};

const contactInfo = [
  { icon: <Mail className="w-5 h-5" />, label: 'Email', value: 'hr@primetekglobalsolutions.com', href: 'mailto:hr@primetekglobalsolutions.com' },
  { icon: <Phone className="w-5 h-5" />, label: 'Phone', value: '+1 (219) 345-6559', href: 'tel:+12193456559' },
  { icon: <MapPin className="w-5 h-5" />, label: 'Office', value: '1680, Unit 2G, 14th Ave S, Birmingham, AL 35205, USA', href: '#' },
  { icon: <Clock className="w-5 h-5" />, label: 'Hours', value: 'Mon - Fri, 9:00 AM - 6:00 PM EST', href: '#' },
];

export default function ContactPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "mainEntity": {
      "@type": "Organization",
      "name": "Primetek Global Solutions",
      "url": "https://www.primetekglobalsolutions.com",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+1-219-345-6559",
        "email": "hr@primetekglobalsolutions.com",
        "contactType": "HR and Sales Support",
        "areaServed": "US",
        "availableLanguage": "en"
      }
    }
  };

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Contact Us', path: '/contact' }
  ];

  return (
    <>
      <SchemaMarkup schema={contactSchema} />
      <SchemaMarkup schema={generateBreadcrumbSchema(breadcrumbs)} />
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="container-wide text-center">
          <span className="inline-block text-primary-300 font-semibold text-sm uppercase tracking-widest mb-3">
            Contact Us
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 max-w-4xl mx-auto">
            Let&apos;s Start a Conversation
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Tell us about your talent needs and we&apos;ll get back to you within 24 hours.
          </p>
        </div>
      </section>

      {/* Form + Info */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Contact Info */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-heading font-bold text-navy-900 mb-6">
                Get in Touch
              </h2>
              <p className="text-text-secondary leading-relaxed mb-8">
                Whether you&apos;re looking to hire talent, explore consulting services, or discuss an outsourcing engagement — we&apos;re here to help.
              </p>

              <div className="space-y-5">
                {contactInfo.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-surface-alt transition-colors group"
                  >
                    <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center shrink-0 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                        {item.label}
                      </p>
                      <p className="text-navy-900 font-medium text-sm">{item.value}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Inquiry Form */}
            <div className="lg:col-span-3">
              <div className="bg-surface-alt rounded-2xl p-6 md:p-8 border border-border">
                <h2 className="text-2xl font-heading font-bold text-navy-900 mb-2">
                  Send Us an Inquiry
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                  Fill out the form and our team will reach out shortly.
                </p>
                <InquiryForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
