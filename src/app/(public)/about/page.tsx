import type { Metadata } from 'next';
import Link from 'next/link';
import { Target, Eye, Award, Users, Lightbulb, Zap, Briefcase } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import Card from '@/components/ui/Card';
import CTASection from '@/components/sections/CTASection';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Learn about Primetek Global Solutions — our story, mission, vision, and the team behind world-class IT staffing and recruiting.',
};

const values = [
  { icon: <Award className="w-6 h-6" />, title: 'Excellence', description: 'Delivering thoroughly vetted, technically strong professionals.' },
  { icon: <Users className="w-6 h-6" />, title: 'Partnership', description: 'Aligning with clients’ business goals, not just filling roles.' },
  { icon: <Zap className="w-6 h-6" />, title: 'Speed', description: 'Fast‑track hiring while maintaining fit and quality.' },
  { icon: <Lightbulb className="w-6 h-6" />, title: 'Innovation', description: 'Using modern sourcing and analytics‑driven recruiting methods.' },
];

const usps = [
  "US‑focused IT staffing with deep market understanding.",
  "Diverse client base: Fortune 500s, mid‑size enterprises, government, and startups.",
  "Vetted, job‑ready talent with rigorous technical and cultural screening.",
  "Flexible models: Contract, C2C, contract‑to‑hire, and full‑time.",
  "Scalable solutions for both short‑term projects and long‑term growth."
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="container-wide text-center">
          <span className="inline-block text-primary-300 font-semibold text-sm uppercase tracking-widest mb-3">
            Company Overview
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 max-w-4xl mx-auto">
            About Primetek Global Solutions
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Primetek Global Solutions LLC is a US‑based IT staffing and recruiting company founded in 2024, headquartered in Birmingham, Alabama.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <SectionHeading label="Who We Are" title="End-to-End IT Talent Solutions" centered={false} />
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>
                  At Primetek Global Solutions, we provide end‑to‑end IT talent solutions, including contract, C2C, contract‑to‑hire, and full‑time placements.
                </p>
                <p>
                  We specialize in placing highly skilled IT professionals with US‑based clients across Fortune 500 companies, mid‑size enterprises, government agencies, and startups.
                </p>
                <p>
                  Our team focuses on sourcing, screening, and deploying job‑ready professionals in software development, data science/AI/ML, cloud/DevOps, cybersecurity, QA/test automation, ERP technologies, and business/program management domains.
                </p>
              </div>
            </div>
            <div className="relative">
              <Card className="p-8 bg-surface-alt border-none shadow-xl">
                <h3 className="text-xl font-heading font-bold text-navy-900 mb-6 border-b border-border pb-4">Company At a Glance</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between">
                    <span className="text-text-muted font-medium">Founded</span>
                    <span className="text-navy-900 font-bold">2024</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted font-medium">Headquarters</span>
                    <span className="text-navy-900 font-bold text-right">Birmingham, AL</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted font-medium">Company Size</span>
                    <span className="text-navy-900 font-bold">11–50 employees</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted font-medium">Industry</span>
                    <span className="text-navy-900 font-bold text-right">IT Staffing & Recruiting</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="section-padding bg-surface-alt">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-8 md:p-10 border-l-4 border-l-primary-500">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-primary-500" />
                <h3 className="text-2xl font-heading font-bold text-navy-900">Our Mission</h3>
              </div>
              <p className="text-text-secondary leading-relaxed">
                To empower businesses with scalable, high‑quality IT talent solutions that drive innovation and growth.
              </p>
            </Card>
            <Card className="p-8 md:p-10 border-l-4 border-l-gold-500">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-6 h-6 text-gold-500" />
                <h3 className="text-2xl font-heading font-bold text-navy-900">Our Vision</h3>
              </div>
              <p className="text-text-secondary leading-relaxed">
                To become a trusted global partner for US‑facing IT staffing, known for speed, quality, and candidate‑centric service.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <SectionHeading label="Our Values" title="What Drives Us" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <Card key={value.title} className="text-center p-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-50 text-primary-500 mb-5">
                  {value.icon}
                </div>
                <h3 className="text-lg font-heading font-bold text-navy-900 mb-2">{value.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{value.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* USP */}
      <section className="section-padding bg-navy-900 text-white">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <SectionHeading label="Why Choose Us" title="Why Choose Primetek Global Solutions" centered={true} light={true} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {usps.map((usp, i) => (
              <div key={i} className="flex items-start gap-4 p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="mt-1 w-6 h-6 shrink-0 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
                  <CheckCircleIcon className="w-4 h-4" />
                </div>
                <p className="text-gray-300 leading-relaxed text-sm">{usp}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
