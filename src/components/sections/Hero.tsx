'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import Button from '@/components/ui/Button';

const techDomains = [
  'Software Dev',
  'Cloud/DevOps',
  'Data Science',
  'Cybersecurity',
  'QA',
  'ERP'
];

const steps = [
  {
    num: '01',
    title: 'Submit your requirement',
    desc: 'Specify the role, tech stack, and timeline via our contact form.'
  },
  {
    num: '02',
    title: 'We source candidates (3-5 days)',
    desc: 'We present fully vetted, job-ready profiles from our network.'
  },
  {
    num: '03',
    title: 'You interview and hire',
    desc: 'Conduct interviews and select your candidate. We handle all paperwork.'
  }
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-white pt-24 pb-16 overflow-hidden">
      {/* Decorative Grid Overlay (Subtle) */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="max-w-[1200px] mx-auto px-4 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* LEFT (7 Columns) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-primary text-white text-[11px] font-semibold tracking-wider uppercase mb-6 w-fit"
            >
              US-Based IT Staffing
            </motion.div>

            {/* H1 Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-semibold text-ink leading-[1.05] tracking-[-2px] mb-6"
            >
              IT Staffing for US Companies.<br />
              <span className="text-teal-primary">Contract, C2C, Full-Time.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-base text-muted leading-relaxed mb-8 max-w-xl"
            >
              We place skilled IT professionals with US-based clients across contract, C2C, and full-time roles. Positions filled in 3–5 business days.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-4 mb-8"
            >
              <Link href="/contact" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-teal-primary hover:bg-teal-active text-white border-0">
                  Submit a Requirement <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/services" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-hairline text-ink hover:bg-surface-card hover:text-ink">
                  Our Services
                </Button>
              </Link>
            </motion.div>

            {/* Domain Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="flex flex-wrap gap-2 items-center"
            >
              <span className="text-xs font-semibold text-muted uppercase tracking-wider mr-2">Domains:</span>
              {techDomains.map((domain) => (
                <span
                  key={domain}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-surface-card text-body-text border border-hairline"
                >
                  {domain}
                </span>
              ))}
            </motion.div>
          </div>

          {/* RIGHT (5 Columns) */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="bg-white rounded-2xl border border-hairline shadow-sm overflow-hidden"
            >
              {/* Graphic Asset Mockup */}
              <div className="relative w-full h-[220px] bg-surface-card flex items-center justify-center p-6 border-b border-hairline">
                <Image
                  src="/laptop_code_icon.png"
                  alt="IT Staffing illustration showing laptop with code brackets and floating cloud, database, gear and shield icons"
                  width={320}
                  height={200}
                  className="object-contain max-h-full"
                  style={{ width: 'auto', height: 'auto' }}
                  priority
                />
              </div>

              {/* Steps inside the card */}
              <div className="p-6 md:p-8 space-y-6">
                <h3 className="text-lg font-semibold text-ink border-b border-hairline pb-3">
                  How Recruiting Works
                </h3>
                <div className="space-y-4">
                  {steps.map((step) => (
                    <div key={step.num} className="flex gap-4 items-start">
                      <div className="text-lg font-semibold text-teal-primary shrink-0 leading-none pt-1">
                        {step.num}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink leading-tight mb-1">{step.title}</h4>
                        <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
